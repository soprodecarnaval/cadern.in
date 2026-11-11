/* eslint-disable react-refresh/only-export-components -- Story fixtures combine data and renderers. */
import type { User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { useState, type ComponentProps } from "react";
import type {
  ProjectDoc,
  ProjectMemberDoc,
  ReviewCommentDoc,
  ScoreDoc,
  ScoreRevisionDoc,
  SongbookDoc,
  SongbookRevisionDoc,
  UserProjectInvitationDoc,
} from "../../types/docs";
import type { WithId } from "../lib/db";
import type { LoadedScore } from "../lib/loadScore";
import {
  numberSongbookItems,
  songbookScore,
  songbookSection,
} from "../lib/songbook";
import { toScoreViewModel } from "../lib/viewModels";
import { PDFGeneratorView } from "./PdfGeneratorView";
import { ReviewCommentsPanelView } from "./ReviewCommentsPanelView";
import { SaveSongbookModalView } from "./SaveSongbookModalView";
import { ScoreCardView, type ScoreCardProps } from "./ScoreCardView";
import { ScoreDisplayView } from "./ScoreDisplayView";
import { ScoreLineageView } from "./ScoreLineageView";
import { ScoreMetadataEditorView } from "./ScoreMetadataEditorView";
import { ScoreRevisionListView } from "./ScoreRevisionListView";
import { SongbookGenerationPanelView } from "./SongbookGenerationPanelView";
import { noop, part } from "./storyFixtures";

export const date = Timestamp.fromDate(new Date("2026-02-01T12:00:00Z"));
export const user: User = {
  uid: "fixture-user",
  displayName: "Ana Silva",
  email: "ana@example.test",
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  providerData: [],
  providerId: "firebase",
  phoneNumber: null,
  tenantId: null,
  refreshToken: "",
  metadata: {},
  delete: () => Promise.resolve(),
  reload: () => Promise.resolve(),
  getIdToken: () => Promise.resolve(""),
  getIdTokenResult: () =>
    Promise.resolve({
      token: "",
      authTime: "",
      issuedAtTime: "",
      expirationTime: "",
      signInProvider: null,
      signInSecondFactor: null,
      claims: {},
    }),
  toJSON: () => ({ uid: "fixture-user" }),
};
export const project: WithId<ProjectDoc> = {
  id: "bloco-exemplo",
  slug: "bloco-exemplo",
  title: "Bloco de exemplo",
  memberIds: [user.uid],
  createdAt: date,
  deletedAt: null,
};
export const metadata = {
  title: "Carnaval em Belo Horizonte",
  composer: "Compositor de exemplo",
  sub: "Arranjo para bloco",
  tags: ["carnaval", "samba"],
};
export const scoreDoc: WithId<ScoreDoc> = {
  id: "fixture-score",
  projectId: project.id,
  uploadedBy: user.uid,
  latestRevisionId: "revision-2",
  ...metadata,
  cachedMetadata: metadata,
  createdAt: date,
  deletedAt: null,
  published: {
    revisionId: "revision-2",
    songbookIds: ["bloco-exemplo~carnaval"],
  },
};
const emptyFile = { path: "", url: "" };
export const revisionDoc: WithId<ScoreRevisionDoc> = {
  id: "revision-2",
  revisionNumber: 2,
  uploadedBy: user.uid,
  uploadedAt: date,
  mscz: { path: "fixture.mscz", url: "data:application/octet-stream,fixture" },
  metajson: emptyFile,
  midi: emptyFile,
  notes: "Revisão do arranjo",
  metadata,
  parts: [
    {
      name: part.name,
      instrument: part.instrument,
      svg: part.svg.map((url) => ({ path: "fixture.svg", url })),
      midi: emptyFile,
    },
  ],
};
export const score = toScoreViewModel(scoreDoc, revisionDoc, project.title);
export const availableScoreDoc: WithId<ScoreDoc> = {
  ...scoreDoc,
  id: "fixture-score-2",
  title: "Marchinha do bloco",
  cachedMetadata: { ...metadata, title: "Marchinha do bloco" },
};
export const availableScore = toScoreViewModel(
  availableScoreDoc,
  revisionDoc,
  project.title,
);
export const builderItems = [songbookSection("Sambas"), songbookScore(score)];
export const songbook: WithId<SongbookDoc> = {
  id: "bloco-exemplo~carnaval",
  slug: "carnaval",
  title: "Carnaval 2026",
  projectId: project.id,
  currentRevisionId: "book-revision-2",
  isPublished: true,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
};
export const bookRevision: WithId<SongbookRevisionDoc> = {
  id: "book-revision-2",
  revisionNumber: 2,
  prevRevisionId: "book-revision-1",
  createdBy: user.uid,
  note: "Repertório do desfile",
  createdAt: date,
  covers: {},
  pins: { [score.id]: revisionDoc.id },
  entries: [
    { type: "section", title: "Sambas", order: 0 },
    { type: "score", scoreId: score.id, index: 1, order: 1 },
  ],
};
export const members: ProjectMemberDoc[] = [
  {
    uid: user.uid,
    role: "owner",
    displayName: user.displayName!,
    addedBy: user.uid,
    addedAt: date,
  },
  {
    uid: "reviewer",
    role: "reviewer",
    displayName: "Bruno Santos",
    addedBy: user.uid,
    addedAt: date,
  },
];
export const invitation: WithId<UserProjectInvitationDoc> = {
  id: "invitation",
  projectId: project.id,
  projectTitle: project.title,
  fromUserId: user.uid,
  toUserId: "invitee",
  fromDisplayName: user.displayName!,
  toDisplayName: "Carla Souza",
  role: "editor",
  accepted: null,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
};
export const comment: WithId<ReviewCommentDoc> = {
  id: "comment-1",
  authorId: user.uid,
  authorName: user.displayName!,
  body: "Conferir a articulação neste compasso.",
  parentId: null,
  anchor: { partName: part.name, page: 1, x: 0.4, y: 0.5 },
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
};
export const loadedScore: LoadedScore = {
  ...metadata,
  scoreId: score.id,
  revisionId: revisionDoc.id,
  latestRevisionId: revisionDoc.id,
  publishedRevisionId: revisionDoc.id,
  forkedFrom: undefined,
  revisionNumber: 2,
  uploaded: metadata,
  projectId: project.id,
  projectTitle: project.title,
  msczUrl: revisionDoc.mscz.url,
  arrangementMidiUrl: null,
  parts: [
    {
      name: part.name,
      instrument: part.instrument,
      svgUrls: part.svg,
      midiUrl: null,
    },
  ],
};
export const resolve = () => Promise.resolve();
export const pending = <T,>(): Promise<T> => new Promise(() => undefined);
export const fail = () =>
  Promise.reject(new Error("Não foi possível salvar. Tente novamente."));

// These local operations are passed through props; no application service is imported at runtime.
export const services = {
  getProjectBySlug: () => Promise.resolve(project),
  getProject: () => Promise.resolve(project),
  getUserMemberProjects: () => Promise.resolve([project]),
  getProjectScores: () => Promise.resolve([scoreDoc]),
  getAllProjects: () => Promise.resolve([project]),
  getAllScores: () => Promise.resolve([scoreDoc, availableScoreDoc]),
  getUserScores: () => Promise.resolve([scoreDoc]),
  getScore: () => Promise.resolve(scoreDoc),
  getScoreForks: () => Promise.resolve([]),
  getScoreRevision: () => Promise.resolve(revisionDoc),
  getScoreRevisions: () =>
    Promise.resolve([
      revisionDoc,
      { ...revisionDoc, id: "revision-1", revisionNumber: 1 },
    ]),
  getMemberRole: () => Promise.resolve("owner" as const),
  getProjectMembers: () => Promise.resolve(members),
  getProjectSongbooks: () => Promise.resolve([songbook]),
  getSongbookById: () => Promise.resolve(songbook),
  getSongbook: () => Promise.resolve(songbook),
  getSongbookRevision: () => Promise.resolve(bookRevision),
  getSongbookRevisions: () =>
    Promise.resolve([
      bookRevision,
      { ...bookRevision, id: "book-revision-1", revisionNumber: 1 },
    ]),
  getProjectUserProjectInvitations: () => Promise.resolve([invitation]),
  getPendingUserProjectInvitations: () => Promise.resolve([invitation]),
  getComments: () => Promise.resolve([comment]),
  countComments: () => Promise.resolve(1),
  loadScore: () => Promise.resolve(loadedScore),
  loadPinnedScores: () =>
    Promise.resolve(
      new Map([
        [score.id, { score, deleted: false, latestRevisionId: revisionDoc.id }],
      ]),
    ),
  findUserForInvite: () =>
    Promise.resolve({
      status: "found" as const,
      uid: "new-member",
      displayName: "Carla Souza",
    }),
  createProject: resolve,
  updateProjectTitle: resolve,
  removeProjectMember: resolve,
  updateProjectMemberRole: resolve,
  createUserProjectInvitation: resolve,
  cancelUserProjectInvitation: resolve,
  softDeleteProject: resolve,
  softDeleteScore: resolve,
  setSongbookPublished: resolve,
  softDeleteSongbook: resolve,
  swapSongbookEntryToFork: resolve,
  createSongbook: () => Promise.resolve(songbook.id),
  createSongbookRevision: () => Promise.resolve("book-revision-3"),
  addComment: () => Promise.resolve("new-comment"),
  editComment: resolve,
  softDeleteComment: resolve,
  updateScoreMetadataOverride: resolve,
  acceptUserProjectInvitation: resolve,
  denyUserProjectInvitation: resolve,
  updateDisplayName: resolve,
  updateAvatar: resolve,
  changePassword: resolve,
  logout: resolve,
  saveAsNewSongbook: () => Promise.resolve({ slug: songbook.slug }),
  getOrCreateDefaultProject: () => Promise.resolve(project.id),
};
export const collection = {
  status: "ready" as const,
  allScores: [score, availableScore],
  search: (query: string) =>
    [score, availableScore].filter(
      (candidate) =>
        !query ||
        candidate.title
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
    ),
  getMatches: () => undefined,
};
export const storage = {
  restoreBuilderItems: () => builderItems,
  storeBuilderItems: noop,
  markPendingSave: noop,
  takePendingSave: () => false,
};
export const generate = (
  options: import("../lib/generateSongbookPdfs").GenerateSongbookPdfsOptions,
) => {
  options.instruments.forEach((instrument, i) => {
    options.onStart?.(instrument);
    options.onComplete?.(instrument, i, options.instruments.length);
  });
  return Promise.resolve();
};
export function ScreenCard(props: ScoreCardProps) {
  return (
    <ScoreCardView
      {...props}
      lineage={null}
      onShowDetail={noop}
    />
  );
}
function SilentMidi() {
  return <span className="text-muted small">MIDI — reprodução simulada</span>;
}
function Display(
  props: ComponentProps<typeof import("./ScoreDisplay").ScoreDisplay>,
) {
  return <ScoreDisplayView {...props} MidiPlayer={SilentMidi} />;
}
function Lineage(
  props: ComponentProps<typeof import("./ScoreLineage").ScoreLineage>,
) {
  return <ScoreLineageView {...props} services={services} />;
}
function Revisions(
  props: ComponentProps<typeof import("./ScoreRevisionList").ScoreRevisionList>,
) {
  return <ScoreRevisionListView {...props} services={services} />;
}
function Comments(
  props: ComponentProps<
    typeof import("./ReviewCommentsPanel").ReviewCommentsPanel
  >,
) {
  return <ReviewCommentsPanelView {...props} services={services} />;
}
function MetadataEditor(
  props: ComponentProps<
    typeof import("./ScoreMetadataEditor").ScoreMetadataEditor
  >,
) {
  return <ScoreMetadataEditorView {...props} services={services} />;
}
function SaveModal(
  props: ComponentProps<typeof import("./SaveSongbookModal").SaveSongbookModal>,
) {
  return <SaveSongbookModalView {...props} services={services} />;
}
function Pdf(
  props: ComponentProps<typeof import("./PdfGenerator").PDFGenerator>,
) {
  return <PDFGeneratorView {...props} generateSongbookPdfs={generate} />;
}
function Generation(
  props: ComponentProps<
    typeof import("./SongbookGenerationPanel").SongbookGenerationPanel
  >,
) {
  return (
    <SongbookGenerationPanelView
      {...props}
      currentUser={user}
      generateSongbookPdfs={generate}
      saveSongbookCovers={resolve}
    />
  );
}
export const scoreComponents = {
  ScoreDisplay: Display,
  ScoreLineage: Lineage,
  ScoreRevisionList: Revisions,
  ReviewCommentsPanel: Comments,
  ScoreMetadataEditor: MetadataEditor,
};
export const homeComponents = {
  Card: ScreenCard,
  PDFGenerator: Pdf,
  SaveSongbookModal: SaveModal,
};
export const songbookComponents = {
  ScoreCard: ScreenCard,
  SongbookGenerationPanel: Generation,
  SongbookReader: (): JSX.Element => {
    return (
      <p className="text-muted">SongbookReader fora do escopo desta galeria.</p>
    );
  },
};
export const numberedItems = numberSongbookItems(builderItems);

export function DialogStory<
  Props extends { show: boolean; onHide: () => void },
>({
  args,
  Component,
}: {
  args: Props;
  Component: import("react").ComponentType<Props>;
}) {
  const [show, setShow] = useState(args.show);
  return (
    <>
      <button className="btn btn-outline-primary" onClick={() => setShow(true)}>
        Reabrir diálogo
      </button>
      <Component
        {...args}
        show={show}
        onHide={() => {
          args.onHide();
          setShow(false);
        }}
      />
    </>
  );
}
