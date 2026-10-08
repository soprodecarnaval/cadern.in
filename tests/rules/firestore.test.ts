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

  it("BUG (003): lets the owner hard-delete the project", async () => {
    await seedProject(testEnv());
    await assertSucceeds(deleteDoc(doc(as(OWNER), "projects", PROJECT)));
  });

  it("denies an admin deleting the project", async () => {
    await seedProject(testEnv());
    await assertFails(deleteDoc(doc(as(ADMIN), "projects", PROJECT)));
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

describe("scores", () => {
  const score = {
    title: "Nova",
    projectId: PROJECT,
    uploadedBy: EDITOR,
    latestRevisionId: "",
    deletedAt: null,
  };

  it("is world-readable", async () => {
    await seedProject(testEnv());
    await assertSucceeds(getDoc(doc(as(null), "scores", SCORE)));
  });

  it("lets an editor create a score", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      setDoc(doc(as(EDITOR), "scores", "acervo-nova"), score),
    );
  });

  it("denies a reviewer or outsider creating a score", async () => {
    await seedProject(testEnv());
    await assertFails(
      setDoc(doc(as(REVIEWER), "scores", "acervo-nova"), score),
    );
    await assertFails(
      setDoc(doc(as(OUTSIDER), "scores", "acervo-nova"), score),
    );
  });

  it("BUG (002): lets an editor update any score field", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      updateDoc(doc(as(EDITOR), "scores", SCORE), { title: "Outro" }),
    );
  });

  it("BUG (003): lets an admin hard-delete a score", async () => {
    await seedProject(testEnv());
    await assertSucceeds(deleteDoc(doc(as(ADMIN), "scores", SCORE)));
  });

  it("denies an editor deleting a score", async () => {
    await seedProject(testEnv());
    await assertFails(deleteDoc(doc(as(EDITOR), "scores", SCORE)));
  });
});

describe("score revisions (legacy `revisions`)", () => {
  const revision = { revisionNumber: 2, uploadedBy: EDITOR, isLatest: true };

  it("is world-readable, including the collection-group query", async () => {
    await seedProject(testEnv());
    await seed((db) =>
      setDoc(doc(db, "scores", SCORE, "revisions", "1"), {
        ...revision,
        revisionNumber: 1,
      }),
    );
    await assertSucceeds(
      getDoc(doc(as(null), "scores", SCORE, "revisions", "1")),
    );
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(as(null), "revisions"),
          where("isLatest", "==", true),
        ),
      ),
    );
  });

  it("lets an editor create a revision", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      setDoc(doc(as(EDITOR), "scores", SCORE, "revisions", "2"), revision),
    );
  });

  it("denies a reviewer creating a revision", async () => {
    await seedProject(testEnv());
    await assertFails(
      setDoc(doc(as(REVIEWER), "scores", SCORE, "revisions", "2"), revision),
    );
  });

  it("BUG (002): lets an editor rewrite any revision field", async () => {
    await seedProject(testEnv());
    await seed((db) =>
      setDoc(doc(db, "scores", SCORE, "revisions", "1"), revision),
    );
    await assertSucceeds(
      updateDoc(doc(as(EDITOR), "scores", SCORE, "revisions", "1"), {
        uploadedBy: OUTSIDER,
      }),
    );
  });
});

describe("score revisions (`scoreRevisions`)", () => {
  const revision = { revisionNumber: 2, uploadedBy: EDITOR };
  const ref = (db: Firestore, id = "2") =>
    doc(db, "scores", SCORE, "scoreRevisions", id);

  it("is world-readable", async () => {
    await seedProject(testEnv());
    await seed((db) => setDoc(ref(db, "1"), revision));
    await assertSucceeds(getDoc(ref(as(null), "1")));
  });

  it("lets an editor create a revision", async () => {
    await seedProject(testEnv());
    await assertSucceeds(setDoc(ref(as(EDITOR)), revision));
  });

  it("denies a reviewer or outsider creating a revision", async () => {
    await seedProject(testEnv());
    await assertFails(setDoc(ref(as(REVIEWER)), revision));
    await assertFails(setDoc(ref(as(OUTSIDER)), revision));
  });

  it("denies everyone updating or deleting a revision", async () => {
    await seedProject(testEnv());
    await seed((db) => setDoc(ref(db, "1"), revision));
    await assertFails(updateDoc(ref(as(OWNER), "1"), { notes: "x" }));
    await assertFails(deleteDoc(ref(as(OWNER), "1")));
  });

  it("accepts the dual-write batch uploadScore commits", async () => {
    await seedProject(testEnv());
    await seed((db) =>
      setDoc(doc(db, "scores", SCORE, "revisions", "1"), {
        revisionNumber: 1,
        isLatest: true,
      }),
    );
    const db = as(EDITOR);
    const batch = writeBatch(db);
    batch.set(ref(db), revision);
    batch.set(doc(db, "scores", SCORE, "revisions", "2"), {
      ...revision,
      isLatest: true,
    });
    batch.update(doc(db, "scores", SCORE, "revisions", "1"), {
      isLatest: false,
    });
    await assertSucceeds(batch.commit());
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
