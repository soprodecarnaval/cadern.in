import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  deleteObject,
  getBytes,
  ref,
  updateMetadata,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { describe, expect, it } from "vitest";
import { deleteField, doc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import {
  ADMIN, EDITOR, OUTSIDER, OWNER, PROJECT, REVIEWER, SCORE,
  seedProject, useTestEnv as setupTestEnv,
} from "./testEnv";

const testEnv = setupTestEnv();
const BYTES = new Uint8Array([1, 2, 3]);
const SB = `${PROJECT}~carnaval`;
const scorePath = (project = PROJECT, score = SCORE) =>
  `projects/${project}/scores/${score}/r1/score.mscz`;
const coverPath = (project = PROJECT) =>
  `projects/${project}/songbooks/${SB}/r2/covers/trompete.png`;

const as = (uid: string | null): FirebaseStorage => {
  const ctx = uid === null
    ? testEnv().unauthenticatedContext()
    : testEnv().authenticatedContext(uid);
  return ctx.storage() as unknown as FirebaseStorage;
};

async function seedFile(path: string) {
  await testEnv().withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage() as unknown as FirebaseStorage, path), BYTES);
  });
}

for (const [kind, path, allowed, denied] of [
  ["scores", scorePath, [OWNER, ADMIN, EDITOR], [REVIEWER, OUTSIDER, null]],
  ["covers", coverPath, [OWNER, ADMIN], [EDITOR, REVIEWER, OUTSIDER, null]],
] as const) {
  describe(`project-scoped ${kind}`, () => {
    it("allows the correct roles without reading score or songbook documents", async () => {
      await seedProject(testEnv());
      for (const uid of allowed) {
        await assertSucceeds(uploadBytes(ref(as(uid), path()), BYTES));
      }
      for (const uid of denied) {
        await assertFails(uploadBytes(ref(as(uid), path()), BYTES));
      }
    });

    it("denies writes in another project's namespace, even with matching resource IDs", async () => {
      await seedProject(testEnv());
      await testEnv().withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore() as unknown as Firestore, "projects", "other"), {
          deletedAt: null,
        });
      });
      await seedFile(path("other"));
      const foreign = ref(as(OWNER), path("other"));
      await assertFails(uploadBytes(foreign, BYTES));
      await assertFails(updateMetadata(foreign, { contentType: "image/png" }));
      await assertFails(deleteObject(foreign));
    });

    it("denies writes to deleted and missing projects, even with a member document", async () => {
      await seedProject(testEnv());
      await seedFile(path());
      await testEnv().withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as unknown as Firestore;
        await updateDoc(doc(db, "projects", PROJECT), { deletedAt: new Date() });
        await setDoc(doc(db, "projects", "missing", "members", OWNER), { role: "owner" });
      });
      await assertFails(uploadBytes(ref(as(OWNER), path()), BYTES));
      await assertFails(updateMetadata(ref(as(OWNER), path()), { contentType: "image/png" }));
      await assertFails(deleteObject(ref(as(OWNER), path())));
      await assertFails(uploadBytes(ref(as(OWNER), path("missing")), BYTES));
    });

    it("supports live projects created before deletedAt existed", async () => {
      await seedProject(testEnv());
      await testEnv().withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore() as unknown as Firestore, "projects", PROJECT), {
          deletedAt: deleteField(),
        });
      });
      await assertSucceeds(uploadBytes(ref(as(OWNER), path()), BYTES));
    });

    it("allows authorized metadata updates and deletes", async () => {
      await seedProject(testEnv());
      await seedFile(path());
      const own = ref(as(OWNER), path());
      await assertSucceeds(updateMetadata(own, { contentType: "image/png" }));
      await assertSucceeds(deleteObject(own));
    });

    it("keeps files world-readable", async () => {
      await seedFile(path());
      await assertSucceeds(getBytes(ref(as(null), path())));
    });
  });
}

describe("score upload asset types", () => {
  it("authorizes the whole revision, including nested parts and forks", async () => {
    await seedProject(testEnv());
    for (const asset of ["score.mscz", "score.metajson", "score.midi", "parts/trompete-1.svg", "parts/trompete.midi"]) {
      const path = `projects/${PROJECT}/scores/new-fork/new-revision/${asset}`;
      await assertSucceeds(uploadBytes(ref(as(EDITOR), path), BYTES));
    }
  });
});

describe("legacy asset paths", () => {
  for (const path of [`scores/${SCORE}/1/score.mscz`, `songbooks/${SB}/r1/covers/trompete.png`]) {
    it(`preserves reads and denies all client writes: ${path}`, async () => {
      await seedProject(testEnv());
      await seedFile(path);
      await assertSucceeds(getBytes(ref(as(null), path)));
      const legacy = ref(as(OWNER), path);
      await assertFails(uploadBytes(legacy, BYTES));
      await assertFails(updateMetadata(legacy, { contentType: "image/png" }));
      await assertFails(deleteObject(legacy));
    });
  }
});

describe("avatars", () => {
  it("lets a user write only their own avatar", async () => {
    await assertSucceeds(uploadBytes(ref(as(EDITOR), `avatars/${EDITOR}`), BYTES));
    await assertFails(uploadBytes(ref(as(EDITOR), `avatars/${OUTSIDER}`), BYTES));
  });
});

describe("unrecognized paths", () => {
  it("denies writes outside the allowed namespaces", async () => {
    await seedProject(testEnv());
    for (const path of [`songs/${SCORE}/1/x`, `projects/${PROJECT}/misc/x`, `projects/${PROJECT}/avatars/${OWNER}`]) {
      await assertFails(uploadBytes(ref(as(OWNER), path), BYTES));
      await assertFails(getBytes(ref(as(null), path)));
    }
  });
});

// The emulator permits the three-read rule that live Storage rejects. Keep
// the complete ruleset within its two-document Firestore lookup budget.
describe("Storage rules Firestore lookup budget", () => {
  it("reads only the project and membership, never the score or songbook", () => {
    const rules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8")
      .replace(/\/\/[^\n]*/g, "");
    expect(rules.match(/firestore\.(?:get|exists)\s*\(/g)).toHaveLength(2);
    expect(rules).not.toMatch(/documents\/(?:scores|songbooks)\//);
    expect(rules).toContain("/documents/projects/$(projectId)");
    expect(rules).toContain("/documents/projects/$(projectId)/members/$(request.auth.uid)");
  });
});
