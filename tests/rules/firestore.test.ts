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

  it("BUG (001): denies the invite-by-email lookup", async () => {
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
  it("is world-readable", async () => {
    await seedProject(testEnv());
    await assertSucceeds(getDoc(doc(as(null), "projects", PROJECT)));
  });

  it("lets a user create a project they own", async () => {
    await assertSucceeds(
      setDoc(doc(as(OUTSIDER), "projects", "novo"), {
        title: "Novo",
        slug: "novo",
        members: { [OUTSIDER]: "owner" },
        memberIds: [OUTSIDER],
      }),
    );
  });

  it("denies creating a project owned by someone else", async () => {
    await assertFails(
      setDoc(doc(as(OUTSIDER), "projects", "novo"), {
        title: "Novo",
        slug: "novo",
        members: { [OWNER]: "owner" },
        memberIds: [OWNER],
      }),
    );
  });

  it("lets an editor change the title only", async () => {
    await seedProject(testEnv());
    const ref = doc(as(EDITOR), "projects", PROJECT);
    await assertSucceeds(updateDoc(ref, { title: "Outro" }));
    await assertFails(updateDoc(ref, { [`members.${OUTSIDER}`]: "editor" }));
  });

  it("denies a reviewer changing the title", async () => {
    await seedProject(testEnv());
    await assertFails(
      updateDoc(doc(as(REVIEWER), "projects", PROJECT), { title: "Outro" }),
    );
  });

  it("BUG (001): lets an admin grant owner", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      updateDoc(doc(as(ADMIN), "projects", PROJECT), {
        [`members.${OUTSIDER}`]: "owner",
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
    await assertSucceeds(setDoc(doc(as(EDITOR), "scores", "acervo-nova"), score));
  });

  it("denies a reviewer or outsider creating a score", async () => {
    await seedProject(testEnv());
    await assertFails(setDoc(doc(as(REVIEWER), "scores", "acervo-nova"), score));
    await assertFails(setDoc(doc(as(OUTSIDER), "scores", "acervo-nova"), score));
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
  const invitation = {
    fromUserId: ADMIN,
    toUserId: OUTSIDER,
    projectId: PROJECT,
    role: "editor",
    accepted: null,
    deletedAt: null,
  };

  it("lets an admin invite", async () => {
    await seedProject(testEnv());
    await assertSucceeds(
      setDoc(doc(as(ADMIN), "invitations", "inv"), invitation),
    );
  });

  it("denies an editor inviting", async () => {
    await seedProject(testEnv());
    await assertFails(
      setDoc(doc(as(EDITOR), "invitations", "inv"), {
        ...invitation,
        fromUserId: EDITOR,
      }),
    );
  });

  it("lets the invitee read their invitation", async () => {
    await seedProject(testEnv());
    await seed((db) => setDoc(doc(db, "invitations", "inv"), invitation));
    await assertSucceeds(getDoc(doc(as(OUTSIDER), "invitations", "inv")));
  });

  it("BUG (001): denies the invitee accepting", async () => {
    await seedProject(testEnv());
    await seed((db) => setDoc(doc(db, "invitations", "inv"), invitation));
    const db = as(OUTSIDER);
    const batch = writeBatch(db);
    batch.update(doc(db, "invitations", "inv"), { accepted: true });
    batch.update(doc(db, "projects", PROJECT), {
      [`members.${OUTSIDER}`]: "editor",
    });
    await assertFails(batch.commit());
  });
});
