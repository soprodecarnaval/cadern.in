// Baseline for the deployed storage.rules.
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import { describe, it } from "vitest";
import {
  EDITOR,
  OUTSIDER,
  REVIEWER,
  SCORE,
  seedProject,
  useTestEnv,
} from "./testEnv";

const testEnv = useTestEnv();

const BYTES = new Uint8Array([1, 2, 3]);

const as = (uid: string | null): FirebaseStorage => {
  const ctx =
    uid === null
      ? testEnv().unauthenticatedContext()
      : testEnv().authenticatedContext(uid);
  return ctx.storage() as unknown as FirebaseStorage;
};

const scorePath = (scoreId: string) => `scores/${scoreId}/1/score.mscz`;

describe("scores/**", () => {
  it("lets an editor of the score's project upload", async () => {
    await seedProject(testEnv());
    await assertSucceeds(uploadBytes(ref(as(EDITOR), scorePath(SCORE)), BYTES));
  });

  it("denies a reviewer or outsider uploading", async () => {
    await seedProject(testEnv());
    await assertFails(uploadBytes(ref(as(REVIEWER), scorePath(SCORE)), BYTES));
    await assertFails(uploadBytes(ref(as(OUTSIDER), scorePath(SCORE)), BYTES));
  });

  it("denies uploading under a score with no document", async () => {
    await seedProject(testEnv());
    await assertFails(
      uploadBytes(ref(as(EDITOR), scorePath("acervo-inexistente")), BYTES),
    );
  });

  it("is world-readable", async () => {
    await seedProject(testEnv());
    await testEnv().withSecurityRulesDisabled(async (ctx) => {
      const storage = ctx.storage() as unknown as FirebaseStorage;
      await uploadBytes(ref(storage, scorePath(SCORE)), BYTES);
    });
    await assertSucceeds(getBytes(ref(as(null), scorePath(SCORE))));
  });
});

describe("avatars/**", () => {
  it("lets a user write only their own avatar", async () => {
    await assertSucceeds(uploadBytes(ref(as(EDITOR), `avatars/${EDITOR}`), BYTES));
    await assertFails(uploadBytes(ref(as(EDITOR), `avatars/${OUTSIDER}`), BYTES));
  });
});

describe("everything else", () => {
  it("is denied, including the legacy songs/ prefix", async () => {
    await assertFails(uploadBytes(ref(as(EDITOR), `songs/${SCORE}/1/x`), BYTES));
    await assertFails(getBytes(ref(as(null), `songs/${SCORE}/1/x`)));
  });
});
