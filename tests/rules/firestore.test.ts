// Baseline for the deployed firestore.rules. Tests named "BUG" pin behaviour the
// collab-flow plan changes; the slice that fixes it flips the assertion.
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  arrayRemove,
  arrayUnion,
  deleteField,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { describe, it } from "vitest";
import {
  ADMIN,
  EDITOR,
  OUTSIDER,
  OWNER,
  PROJECT,
  REVIEWER,
  SCORE,
  firestoreAs,
  seedProject,
  useTestEnv,
} from "./testEnv";

const testEnv = useTestEnv();

const as = (uid: string | null): Firestore => firestoreAs(testEnv(), uid);

async function seed(fn: (db: Firestore) => Promise<void>) {
  await testEnv().withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore);
  });
}

describe("users", () => {
  it("lets a user read and write their own doc", async () => {
    const ref = doc(as(EDITOR), "users", EDITOR);
    await assertSucceeds(setDoc(ref, { displayName: "E", email: "e@x.com" }));
    await assertSucceeds(getDoc(ref));
  });

  it("denies reading another user's doc", async () => {
    await assertFails(getDoc(doc(as(EDITOR), "users", OWNER)));
  });

  it("denies querying users by email (lookups run in findUserForInvite)", async () => {
    await seed((db) =>
      setDoc(doc(db, "users", OUTSIDER), {
        displayName: "O",
        email: "o@x.com",
      }),
    );
    await assertFails(
      getDocs(
        query(collection(as(ADMIN), "users"), where("email", "==", "o@x.com")),
      ),
    );
  });
});

describe("projects", () => {
  const newProject = (owner: string) => ({
    title: "Novo",
    slug: "novo",
    memberIds: [owner],
    deletedAt: null,
  });
  const ownerDoc = (uid: string) => ({
    uid,
    role: "owner",
    displayName: uid,
    addedBy: uid,
  });

  it("is world-readable", async () => {
    await seedProject(testEnv());
    await assertSucceeds(getDoc(doc(as(null), "projects", PROJECT)));
  });

  it("lets a user create a project with their owner doc in one batch", async () => {
    const db = as(OUTSIDER);
    const batch = writeBatch(db);
    batch.set(doc(db, "projects", "novo"), newProject(OUTSIDER));
    batch.set(
      doc(db, "projects", "novo", "members", OUTSIDER),
      ownerDoc(OUTSIDER),
    );
    await assertSucceeds(batch.commit());
  });

  it("denies creating a project for someone else", async () => {
    const db = as(OUTSIDER);
    await assertFails(setDoc(doc(db, "projects", "novo"), newProject(OWNER)));
  });

  it("denies creating a project with the legacy members map", async () => {
    await assertFails(
      setDoc(doc(as(OUTSIDER), "projects", "novo"), {
        ...newProject(OUTSIDER),
        members: { [OUTSIDER]: "owner" },
      }),
    );
  });

  it("denies claiming ownership of an existing project", async () => {
    await seedProject(testEnv());
    await assertFails(
      setDoc(
        doc(as(OUTSIDER), "projects", PROJECT, "members", OUTSIDER),
        ownerDoc(OUTSIDER),
      ),
    );
  });

  it("ignores the legacy members map", async () => {
    await seed((db) =>
      setDoc(doc(db, "projects", PROJECT), {
        title: "Acervo",
        slug: PROJECT,
        memberIds: [OUTSIDER],
        members: { [OUTSIDER]: "owner" },
      }),
    );
    await assertFails(
      updateDoc(doc(as(OUTSIDER), "projects", PROJECT), { title: "Outro" }),
    );
  });

  it("lets an editor change the title only", async () => {
    await seedProject(testEnv());
    const ref = doc(as(EDITOR), "projects", PROJECT);
    await assertSucceeds(updateDoc(ref, { title: "Outro" }));
    await assertFails(updateDoc(ref, { memberIds: arrayUnion(OUTSIDER) }));
  });

  it("denies a reviewer changing the title", async () => {
    await seedProject(testEnv());
    await assertFails(
      updateDoc(doc(as(REVIEWER), "projects", PROJECT), { title: "Outro" }),
    );
  });

  it("lets an admin maintain memberIds", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      updateDoc(doc(as(ADMIN), "projects", PROJECT), {
        memberIds: arrayRemove(REVIEWER),
      }),
    );
  });

  it("denies a non-member adding themselves to memberIds", async () => {
    await seedProject(testEnv());
    await assertFails(
      updateDoc(doc(as(OUTSIDER), "projects", PROJECT), {
        memberIds: arrayUnion(OUTSIDER),
      }),
    );
  });

  it("denies everyone hard-deleting the project", async () => {
    await seedProject(testEnv());
    await assertFails(deleteDoc(doc(as(OWNER), "projects", PROJECT)));
    await assertFails(deleteDoc(doc(as(ADMIN), "projects", PROJECT)));
  });

  it("lets only the owner soft-delete the project", async () => {
    await seedProject(testEnv());
    const deleted = { deletedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(as(ADMIN), "projects", PROJECT), deleted));
    await assertSucceeds(
      updateDoc(doc(as(OWNER), "projects", PROJECT), deleted),
    );
  });

  it("tolerates projects created before deletedAt existed", async () => {
    await seedProject(testEnv());
    await seed((db) =>
      updateDoc(doc(db, "projects", PROJECT), { deletedAt: deleteField() }),
    );
    await assertSucceeds(
      updateDoc(doc(as(EDITOR), "projects", PROJECT), { title: "Outro" }),
    );
  });
});

describe("a soft-deleted project", () => {
  async function seedDeleted() {
    await seedProject(testEnv());
    await seed((db) =>
      updateDoc(doc(db, "projects", PROJECT), { deletedAt: new Date() }),
    );
  }

  it("stays readable, as do its scores", async () => {
    await seedDeleted();
    await assertSucceeds(getDoc(doc(as(null), "projects", PROJECT)));
    await assertSucceeds(getDoc(doc(as(null), "scores", SCORE)));
  });

  it("can't be restored or renamed, even by its owner", async () => {
    await seedDeleted();
    const ref = doc(as(OWNER), "projects", PROJECT);
    await assertFails(updateDoc(ref, { deletedAt: null }));
    await assertFails(updateDoc(ref, { title: "Outro" }));
  });

  it("takes every write away from its members", async () => {
    await seedDeleted();
    await assertFails(
      setDoc(doc(as(EDITOR), "scores", "acervo-nova"), {
        projectId: PROJECT,
        uploadedBy: EDITOR,
        latestRevisionId: "",
        title: "x",
        composer: "",
        sub: "",
        tags: [],
        published: null,
        deletedAt: null,
      }),
    );
    await assertFails(
      updateDoc(doc(as(ADMIN), "scores", SCORE), {
        metadataOverride: { title: "x" },
      }),
    );
    await assertFails(
      updateDoc(doc(as(OWNER), "projects", PROJECT, "members", EDITOR), {
        role: "reviewer",
      }),
    );
  });

  it("can't be joined through a pending invitation", async () => {
    await seedDeleted();
    await seed((db) =>
      setDoc(doc(db, "projects", PROJECT, "invitations", OUTSIDER), {
        fromUserId: ADMIN,
        toUserId: OUTSIDER,
        projectId: PROJECT,
        role: "editor",
        accepted: null,
        deletedAt: null,
      }),
    );
    const db = as(OUTSIDER);
    const batch = writeBatch(db);
    batch.update(doc(db, "projects", PROJECT, "invitations", OUTSIDER), {
      accepted: true,
      deletedAt: serverTimestamp(),
    });
    batch.set(doc(db, "projects", PROJECT, "members", OUTSIDER), {
      uid: OUTSIDER,
      role: "editor",
      displayName: OUTSIDER,
      addedBy: ADMIN,
    });
    batch.update(doc(db, "projects", PROJECT), {
      memberIds: arrayUnion(OUTSIDER),
    });
    await assertFails(batch.commit());
  });
});

describe("members", () => {
  const member = (uid: string, role: string) => ({
    uid,
    role,
    displayName: uid,
    addedBy: OWNER,
  });
  const ref = (db: Firestore, uid: string) =>
    doc(db, "projects", PROJECT, "members", uid);

  it("is world-readable", async () => {
    await seedProject(testEnv());
    await assertSucceeds(getDoc(ref(as(null), EDITOR)));
  });

  it("lets an admin add editors and reviewers only", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      setDoc(ref(as(ADMIN), OUTSIDER), member(OUTSIDER, "editor")),
    );
    await assertFails(setDoc(ref(as(ADMIN), "x"), member("x", "admin")));
    await assertFails(setDoc(ref(as(ADMIN), "y"), member("y", "owner")));
  });

  it("lets an admin move people between editor and reviewer only", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      updateDoc(ref(as(ADMIN), EDITOR), { role: "reviewer" }),
    );
    await assertFails(updateDoc(ref(as(ADMIN), REVIEWER), { role: "admin" }));
    await assertFails(updateDoc(ref(as(ADMIN), OWNER), { role: "editor" }));
  });

  it("denies an admin removing anyone", async () => {
    await seedProject(testEnv());
    await assertFails(deleteDoc(ref(as(ADMIN), REVIEWER)));
  });

  it("lets the owner grant admin and remove members", async () => {
    await seedProject(testEnv());
    await assertSucceeds(updateDoc(ref(as(OWNER), EDITOR), { role: "admin" }));
    await assertSucceeds(deleteDoc(ref(as(OWNER), REVIEWER)));
  });

  it("never allows a second owner", async () => {
    await seedProject(testEnv());
    await assertFails(updateDoc(ref(as(OWNER), ADMIN), { role: "owner" }));
    await assertFails(
      setDoc(ref(as(OWNER), OUTSIDER), member(OUTSIDER, "owner")),
    );
  });

  it("denies the owner demoting or removing themselves", async () => {
    await seedProject(testEnv());
    await assertFails(updateDoc(ref(as(OWNER), OWNER), { role: "admin" }));
    await assertFails(deleteDoc(ref(as(OWNER), OWNER)));
  });

  it("denies editors managing members", async () => {
    await seedProject(testEnv());
    await assertFails(
      setDoc(ref(as(EDITOR), OUTSIDER), member(OUTSIDER, "reviewer")),
    );
    await assertFails(updateDoc(ref(as(EDITOR), REVIEWER), { role: "editor" }));
  });

  it("denies changing anything but the role", async () => {
    await seedProject(testEnv());
    await assertFails(updateDoc(ref(as(OWNER), EDITOR), { uid: OUTSIDER }));
  });
});

const META = { title: "Olha pro céu", composer: "C", sub: "S", tags: [] };

describe("scores", () => {
  const newScore = (uploadedBy = EDITOR) => ({
    projectId: PROJECT,
    uploadedBy,
    latestRevisionId: "",
    ...META,
    cachedMetadata: META,
    published: null,
    deletedAt: null,
  });
  const ref = (db: Firestore, id = SCORE) => doc(db, "scores", id);

  it("is world-readable", async () => {
    await seedProject(testEnv());
    await assertSucceeds(getDoc(ref(as(null))));
  });

  it("lets an editor create an empty score as its uploader", async () => {
    await seedProject(testEnv());
    await assertSucceeds(setDoc(ref(as(EDITOR), "acervo-nova"), newScore()));
  });

  it("denies creating a score for someone else, with revisions or published", async () => {
    await seedProject(testEnv());
    const db = as(EDITOR);
    await assertFails(setDoc(ref(db, "acervo-nova"), newScore(OWNER)));
    await assertFails(
      setDoc(ref(db, "acervo-nova"), { ...newScore(), latestRevisionId: "1" }),
    );
    await assertFails(
      setDoc(ref(db, "acervo-nova"), {
        ...newScore(),
        published: { revisionId: "1", songbookIds: [] },
      }),
    );
  });

  it("denies a reviewer or outsider creating a score", async () => {
    await seedProject(testEnv());
    await assertFails(setDoc(ref(as(REVIEWER), "acervo-nova"), newScore()));
    await assertFails(setDoc(ref(as(OUTSIDER), "acervo-nova"), newScore()));
  });

  it("denies an editor editing metadata or the pointer directly", async () => {
    await seedProject(testEnv());
    await assertFails(updateDoc(ref(as(EDITOR)), { title: "Outro" }));
    await assertFails(updateDoc(ref(as(EDITOR)), { latestRevisionId: "2" }));
  });

  it("lets an admin set metadataOverride, but not an editor", async () => {
    await seedProject(testEnv());
    const override = { metadataOverride: { composer: "Fixed" } };
    await assertSucceeds(updateDoc(ref(as(ADMIN)), override));
    await assertFails(updateDoc(ref(as(EDITOR)), override));
  });

  it("lets the creator abandon a score only while it has no revision", async () => {
    await seedProject(testEnv());
    await seed((db) => setDoc(ref(db, "acervo-nova"), newScore()));
    await assertFails(
      updateDoc(ref(as(REVIEWER), "acervo-nova"), {
        deletedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(ref(as(EDITOR), "acervo-nova"), {
        deletedAt: serverTimestamp(),
      }),
    );
    // SCORE already has a revision.
    await assertFails(
      updateDoc(ref(as(EDITOR)), { deletedAt: serverTimestamp() }),
    );
  });

  it("lets the owner soft-delete a score", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      updateDoc(ref(as(OWNER)), { deletedAt: serverTimestamp() }),
    );
  });

  it("denies writing the published marker", async () => {
    await seedProject(testEnv());
    await assertFails(
      updateDoc(ref(as(OWNER)), {
        published: { revisionId: "1", songbookIds: [] },
      }),
    );
  });

  it("denies everyone hard-deleting a score", async () => {
    await seedProject(testEnv());
    await assertFails(deleteDoc(ref(as(OWNER))));
    await assertFails(deleteDoc(ref(as(ADMIN))));
  });
});

describe("score revisions", () => {
  // SCORE's latest revision is "1" (seedProject).
  const revision = (prevRevisionId: string | null, uploadedBy = EDITOR) => ({
    revisionNumber: 2,
    uploadedBy,
    prevRevisionId,
    slug: "olha-pro-ceu-20261008T140509",
    metadata: META,
    origin: { type: "upload" },
  });
  const newRef = (db: Firestore, id = "2", scoreId = SCORE) =>
    doc(db, "scores", scoreId, "scoreRevisions", id);
  const legacyRef = (db: Firestore, id: string, scoreId = SCORE) =>
    doc(db, "scores", scoreId, "revisions", id);

  async function seedLatest() {
    await seedProject(testEnv());
    await seed(async (db) => {
      await setDoc(newRef(db, "1"), { ...revision(null), revisionNumber: 1 });
      await setDoc(legacyRef(db, "1"), {
        ...revision(null),
        revisionNumber: 1,
        isLatest: true,
      });
    });
  }

  /** The writes commitScoreRevision makes in its transaction. */
  function commitBatch(
    db: Firestore,
    data: ReturnType<typeof revision>,
    { id = "2", scoreId = SCORE, prev = "1" as string | null } = {},
  ) {
    const batch = writeBatch(db);
    batch.set(newRef(db, id, scoreId), data);
    batch.set(legacyRef(db, id, scoreId), { ...data, isLatest: true });
    if (prev) {
      batch.update(legacyRef(db, prev, scoreId), { isLatest: false });
    }
    batch.update(doc(db, "scores", scoreId), {
      latestRevisionId: id,
      cachedMetadata: META,
      ...META,
    });
    return batch;
  }

  it("is world-readable, including the legacy collection-group query", async () => {
    await seedLatest();
    await assertSucceeds(getDoc(newRef(as(null), "1")));
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(as(null), "revisions"),
          where("isLatest", "==", true),
        ),
      ),
    );
  });

  it("lets an editor append a revision to the chain", async () => {
    await seedLatest();
    await assertSucceeds(commitBatch(as(EDITOR), revision("1")).commit());
  });

  it("lets an editor add the first revision of a new score", async () => {
    await seedProject(testEnv());
    await seed((db) =>
      setDoc(doc(db, "scores", "acervo-nova"), {
        projectId: PROJECT,
        uploadedBy: EDITOR,
        latestRevisionId: "",
      }),
    );
    await assertSucceeds(
      commitBatch(as(EDITOR), revision(null), {
        id: "1",
        scoreId: "acervo-nova",
        prev: null,
      }).commit(),
    );
  });

  it("denies forking or skipping the chain", async () => {
    await seedLatest();
    await assertFails(commitBatch(as(EDITOR), revision(null)).commit());
    await assertFails(commitBatch(as(EDITOR), revision("0")).commit());
  });

  it("denies a revision that doesn't become the latest", async () => {
    await seedLatest();
    await assertFails(setDoc(newRef(as(EDITOR)), revision("1")));
  });

  it("denies a reviewer, or an editor posing as another uploader", async () => {
    await seedLatest();
    await assertFails(
      commitBatch(as(REVIEWER), revision("1", REVIEWER)).commit(),
    );
    await assertFails(commitBatch(as(EDITOR), revision("1", OWNER)).commit());
  });

  it("denies everyone updating or deleting a revision", async () => {
    await seedLatest();
    await assertFails(updateDoc(newRef(as(OWNER), "1"), { notes: "x" }));
    await assertFails(deleteDoc(newRef(as(OWNER), "1")));
  });

  it("lets an editor flip only isLatest on a legacy revision", async () => {
    await seedLatest();
    await assertSucceeds(
      updateDoc(legacyRef(as(EDITOR), "1"), { isLatest: false }),
    );
    await assertFails(
      updateDoc(legacyRef(as(EDITOR), "1"), { uploadedBy: OUTSIDER }),
    );
  });
});

describe("songbooks", () => {
  const songbook = (isPublished: boolean) => ({
    title: "Carnaval 2026",
    projectId: PROJECT,
    slug: "carnaval-2026",
    isPublished,
    entries: [],
  });

  it("lets anyone read a published songbook", async () => {
    await seedProject(testEnv());
    await seed((db) => setDoc(doc(db, "songbooks", "sb"), songbook(true)));
    await assertSucceeds(getDoc(doc(as(null), "songbooks", "sb")));
  });

  it("restricts an unpublished songbook to members", async () => {
    await seedProject(testEnv());
    await seed((db) => setDoc(doc(db, "songbooks", "sb"), songbook(false)));
    await assertFails(getDoc(doc(as(OUTSIDER), "songbooks", "sb")));
    await assertSucceeds(getDoc(doc(as(REVIEWER), "songbooks", "sb")));
  });

  it("BUG (004): lets an editor create and publish a songbook", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      setDoc(doc(as(EDITOR), "songbooks", "sb"), songbook(true)),
    );
  });
});

describe("invitations", () => {
  const invitation = (role = "editor") => ({
    fromUserId: ADMIN,
    toUserId: OUTSIDER,
    projectId: PROJECT,
    role,
    accepted: null,
    projectTitle: "Acervo",
    fromDisplayName: ADMIN,
    toDisplayName: OUTSIDER,
    deletedAt: null,
  });
  const ref = (db: Firestore, uid = OUTSIDER) =>
    doc(db, "projects", PROJECT, "invitations", uid);
  const seedInvitation = (role = "editor") =>
    seed((db) => setDoc(ref(db), invitation(role)));

  /** The batch acceptUserProjectInvitation commits. */
  function acceptBatch(db: Firestore, role = "editor") {
    const batch = writeBatch(db);
    batch.update(ref(db), { accepted: true, deletedAt: serverTimestamp() });
    batch.set(doc(db, "projects", PROJECT, "members", OUTSIDER), {
      uid: OUTSIDER,
      role,
      displayName: OUTSIDER,
      addedBy: ADMIN,
    });
    batch.update(doc(db, "projects", PROJECT), {
      memberIds: arrayUnion(OUTSIDER),
    });
    return batch;
  }

  it("lets an admin invite as editor or reviewer only", async () => {
    await seedProject(testEnv());
    await assertSucceeds(setDoc(ref(as(ADMIN)), invitation("reviewer")));
    await assertFails(setDoc(ref(as(ADMIN)), invitation("admin")));
  });

  it("lets an admin re-invite, overwriting the earlier invitation", async () => {
    await seedProject(testEnv());
    await seedInvitation("reviewer");
    await assertSucceeds(setDoc(ref(as(ADMIN)), invitation("editor")));
  });

  it("denies inviting at a path that doesn't match the invitee", async () => {
    await seedProject(testEnv());
    await assertFails(setDoc(ref(as(ADMIN), "someone-else"), invitation()));
  });

  it("denies an editor inviting", async () => {
    await seedProject(testEnv());
    await assertFails(
      setDoc(ref(as(EDITOR)), { ...invitation(), fromUserId: EDITOR }),
    );
  });

  it("lets the invitee and admins read it, nobody else", async () => {
    await seedProject(testEnv());
    await seedInvitation();
    await assertSucceeds(getDoc(ref(as(OUTSIDER))));
    await assertSucceeds(getDoc(ref(as(ADMIN))));
    await assertFails(getDoc(ref(as(EDITOR))));
  });

  it("lets the invitee list their pending invitations across projects", async () => {
    await seedProject(testEnv());
    await seedInvitation();
    const pending = (db: Firestore, uid: string) =>
      getDocs(
        query(
          collectionGroup(db, "invitations"),
          where("toUserId", "==", uid),
          where("accepted", "==", null),
          where("deletedAt", "==", null),
        ),
      );
    await assertSucceeds(pending(as(OUTSIDER), OUTSIDER));
    await assertFails(pending(as(EDITOR), OUTSIDER));
  });

  it("lets the invitee accept: invitation, member doc and memberIds", async () => {
    await seedProject(testEnv());
    await seedInvitation();
    await assertSucceeds(acceptBatch(as(OUTSIDER)).commit());
  });

  it("denies accepting at a different role than invited", async () => {
    await seedProject(testEnv());
    await seedInvitation("reviewer");
    await assertFails(acceptBatch(as(OUTSIDER), "editor").commit());
  });

  it("denies joining without closing the invitation", async () => {
    await seedProject(testEnv());
    await seedInvitation();
    const db = as(OUTSIDER);
    const batch = writeBatch(db);
    batch.set(doc(db, "projects", PROJECT, "members", OUTSIDER), {
      uid: OUTSIDER,
      role: "editor",
      displayName: OUTSIDER,
      addedBy: ADMIN,
    });
    batch.update(doc(db, "projects", PROJECT), {
      memberIds: arrayUnion(OUTSIDER),
    });
    await assertFails(batch.commit());
  });

  it("denies accepting a cancelled invitation", async () => {
    await seedProject(testEnv());
    await seed((db) =>
      setDoc(ref(db), { ...invitation(), deletedAt: new Date() }),
    );
    await assertFails(acceptBatch(as(OUTSIDER)).commit());
  });

  it("denies joining with no invitation", async () => {
    await seedProject(testEnv());
    const db = as(OUTSIDER);
    await assertFails(
      setDoc(doc(db, "projects", PROJECT, "members", OUTSIDER), {
        uid: OUTSIDER,
        role: "editor",
        displayName: OUTSIDER,
        addedBy: ADMIN,
      }),
    );
  });

  it("lets the invitee decline and an admin cancel", async () => {
    await seedProject(testEnv());
    await seedInvitation();
    await assertSucceeds(
      updateDoc(ref(as(OUTSIDER)), {
        accepted: false,
        deletedAt: serverTimestamp(),
      }),
    );
    await seedInvitation();
    await assertSucceeds(
      updateDoc(ref(as(ADMIN)), { deletedAt: serverTimestamp() }),
    );
  });

  it("denies the invitee changing the role", async () => {
    await seedProject(testEnv());
    await seedInvitation("reviewer");
    await assertFails(updateDoc(ref(as(OUTSIDER)), { role: "editor" }));
  });

  it("denies writing top-level invitations, which no longer exist", async () => {
    await seedProject(testEnv());
    await assertFails(
      setDoc(doc(as(ADMIN), "invitations", "inv"), invitation()),
    );
  });
});
