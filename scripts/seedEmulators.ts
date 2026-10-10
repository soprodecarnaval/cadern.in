/**
 * Resets and seeds the local Firebase emulators for `npm run dev:emulators`.
 *
 * Usage (emulators running via `npm run emulators`):
 *   npm run emulators:seed
 *
 * Talks only to 127.0.0.1 under the `demo-cadernin` project, which can never
 * reach a real one. Score parts are generated SVGs (title + part name) — enough
 * to exercise pages, songbooks and PDFs without MuseScore.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getDownloadURL, getStorage } from "firebase-admin/storage";
import type { Instrument } from "../types/instrument";
import { revisionSlug } from "../src/lib/revisionId";
import { slugify } from "../src/lib/slugify";

const PROJECT_ID = "demo-cadernin";
const BUCKET = `${PROJECT_ID}.appspot.com`;
const HOSTS = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
};
Object.assign(process.env, HOSTS);

const PASSWORD = "senha123";

const USERS = {
  owner: "Dona",
  admin: "Admin",
  editor: "Editora",
  reviewer: "Revisor",
  outsider: "Visitante",
} as const;
type UserKey = keyof typeof USERS;

const PARTS: { name: string; instrument: Instrument }[] = [
  { name: "Trompete", instrument: "trompete" },
  { name: "Trombone", instrument: "trombone" },
  { name: "Sax Alto", instrument: "sax alto" },
];

interface SeedScore {
  title: string;
  composer: string;
  tags: string[];
  revisions: number;
}

const PROJECTS: {
  id: string;
  title: string;
  owner: UserKey;
  members: Partial<Record<UserKey, string>>;
  scores: SeedScore[];
}[] = [
  {
    id: "acervo-dev",
    title: "Acervo Dev",
    owner: "owner",
    members: { admin: "admin", editor: "editor", reviewer: "reviewer" },
    scores: [
      {
        title: "Olha pro Céu",
        composer: "Luiz Gonzaga",
        tags: ["forró"],
        revisions: 2,
      },
      {
        title: "Ai Que Saudade D'Ocê",
        composer: "Vital Farias",
        tags: ["baião"],
        revisions: 1,
      },
      {
        title: "Mamãe Eu Quero",
        composer: "Jararaca",
        tags: ["marchinha"],
        revisions: 1,
      },
      {
        title: "Cidade Maravilhosa",
        composer: "André Filho",
        tags: ["marchinha"],
        revisions: 2,
      },
      {
        title: "Taj Mahal",
        composer: "Jorge Ben",
        tags: ["samba-rock"],
        revisions: 1,
      },
      { title: "Eva", composer: "Banda Eva", tags: ["axé"], revisions: 1 },
    ],
  },
  {
    id: "outro-projeto",
    title: "Outro Projeto",
    owner: "outsider",
    members: {},
    scores: [
      {
        title: "Asa Branca",
        composer: "Luiz Gonzaga",
        tags: ["baião"],
        revisions: 1,
      },
      {
        title: "Chiclete com Banana",
        composer: "Jackson do Pandeiro",
        tags: ["forró"],
        revisions: 1,
      },
      {
        title: "Frevo Mulher",
        composer: "Zé Ramalho",
        tags: ["frevo"],
        revisions: 1,
      },
    ],
  },
];

function partSvg(title: string, part: string, revision: number): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="420" viewBox="0 0 595 420">
  <rect width="595" height="420" fill="white" stroke="black"/>
  <text x="297" y="190" font-size="32" text-anchor="middle" font-family="sans-serif">${esc(title)}</text>
  <text x="297" y="240" font-size="20" text-anchor="middle" font-family="sans-serif">${esc(part)} · versão ${revision}</text>
</svg>`;
}

async function reset(): Promise<void> {
  const del = (host: string, path: string) =>
    fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}${path}`, {
      method: "DELETE",
    });
  await del(HOSTS.FIREBASE_AUTH_EMULATOR_HOST, "/accounts");
  await del(HOSTS.FIRESTORE_EMULATOR_HOST, "/databases/(default)/documents");
  const [files] = await getStorage().bucket().getFiles();
  await Promise.all(files.map((f) => f.delete()));
}

async function upload(path: string, contents: string, contentType: string) {
  const file = getStorage().bucket().file(path);
  await file.save(contents, { contentType });
  return { path, url: await getDownloadURL(file) };
}

async function main(): Promise<void> {
  initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
  const db = getFirestore();
  await reset();

  const uids = {} as Record<UserKey, string>;
  for (const [key, displayName] of Object.entries(USERS) as [
    UserKey,
    string,
  ][]) {
    const user = await getAuth().createUser({
      email: `${key}@dev.cadern.in`,
      password: PASSWORD,
      displayName,
    });
    uids[key] = user.uid;
  }

  let firstScoreIds: string[] = [];
  for (const project of PROJECTS) {
    const memberKeys: [UserKey, string][] = [
      [project.owner, "owner"],
      ...(Object.entries(project.members) as [UserKey, string][]),
    ];
    const projectRef = db.collection("projects").doc(project.id);
    await projectRef.set({
      title: project.title,
      slug: project.id,
      memberIds: memberKeys.map(([k]) => uids[k]),
      createdAt: FieldValue.serverTimestamp(),
      deletedAt: null,
    });
    for (const [key, role] of memberKeys) {
      await projectRef.collection("members").doc(uids[key]).set({
        uid: uids[key],
        role,
        displayName: USERS[key],
        addedBy: uids[project.owner],
        addedAt: FieldValue.serverTimestamp(),
      });
    }

    const scoreIds: string[] = [];
    for (const score of project.scores) {
      const scoreId = `${project.id}-${slugify(score.title)}`;
      const uploader = uids[project.members.editor ? "editor" : project.owner];
      const metadata = {
        title: score.title,
        composer: score.composer,
        sub: "",
        tags: score.tags,
      };
      let prevRevisionId: string | null = null;
      for (let n = 1; n <= score.revisions; n++) {
        const date = new Date(Date.UTC(2026, 0, n, 12));
        const slug = revisionSlug(score.title, date);
        const revisionId = `${slug}-dev${n}`;
        const base = `scores/${scoreId}/${revisionId}`;
        const parts = await Promise.all(
          PARTS.map(async (part) => ({
            name: part.name,
            instrument: part.instrument,
            svg: [
              await upload(
                `${base}/parts/${slugify(part.name)}-1.svg`,
                partSvg(score.title, part.name, n),
                "image/svg+xml",
              ),
            ],
            midi: { path: `${base}/parts/${slugify(part.name)}.midi`, url: "" },
          })),
        );
        const revision = {
          revisionNumber: n,
          uploadedBy: uploader,
          mscz: { path: `${base}/score.mscz`, url: "" },
          metajson: { path: `${base}/score.metajson`, url: "" },
          midi: { path: `${base}/score.midi`, url: "" },
          parts,
          notes: "",
          prevRevisionId,
          slug,
          metadata,
          origin: { type: "upload" },
          uploadedAt: date,
        };
        const scoreRef = db.collection("scores").doc(scoreId);
        await scoreRef
          .collection("scoreRevisions")
          .doc(revisionId)
          .set(revision);
        await scoreRef
          .collection("revisions")
          .doc(revisionId)
          .set({
            ...revision,
            isLatest: n === score.revisions,
          });
        prevRevisionId = revisionId;
      }
      await db
        .collection("scores")
        .doc(scoreId)
        .set({
          projectId: project.id,
          uploadedBy: uploader,
          latestRevisionId: prevRevisionId,
          ...metadata,
          cachedMetadata: metadata,
          published: null,
          createdAt: FieldValue.serverTimestamp(),
          deletedAt: null,
        });
      scoreIds.push(scoreId);
    }
    if (firstScoreIds.length === 0) {
      firstScoreIds = scoreIds;
    }
  }

  // One songbook, pinned to each score's first revision — so scores with a
  // second one ("Olha pro Céu", "Cidade Maravilhosa") show a newer version.
  const songbookId = "acervo-dev~carnaval-dev";
  const pins: Record<string, string> = {};
  for (const id of firstScoreIds.slice(0, 4)) {
    const first = await db
      .collection("scores")
      .doc(id)
      .collection("scoreRevisions")
      .where("revisionNumber", "==", 1)
      .get();
    pins[id] = first.docs[0].id;
  }
  const entries = [
    { type: "section", title: "Marchinhas", order: 0 },
    ...Object.keys(pins).map((scoreId, i) => ({
      type: "score",
      scoreId,
      order: i + 1,
      index: i + 1,
    })),
  ];
  await db
    .collection("songbooks")
    .doc(songbookId)
    .collection("songbookRevisions")
    .doc("r1")
    .set({
      entries,
      pins,
      covers: {},
      revisionNumber: 1,
      prevRevisionId: null,
      createdBy: uids.admin,
      note: "",
      createdAt: FieldValue.serverTimestamp(),
    });
  await db.collection("songbooks").doc(songbookId).set({
    title: "Carnaval Dev",
    projectId: "acervo-dev",
    slug: "carnaval-dev",
    currentRevisionId: "r1",
    isPublished: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    deletedAt: null,
  });

  console.log("Seeded. Users (password " + PASSWORD + "):");
  for (const key of Object.keys(USERS)) {
    console.log(`  ${key}@dev.cadern.in — ${USERS[key as UserKey]}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
