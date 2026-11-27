import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, expect, it } from "vitest";
import { changeScoreReviewRequestHandler as change } from "../src/scoreReviewRequests";
import { resetFirestore, useEmulators } from "./emulator";

useEmulators();
const project = () => getFirestore().collection("projects").doc("project");
const requests = () => project().collection("scoreReviewRequests");
const request = (uid = "requester", revisionId = "v1") =>
  change(uid, { action: "request", projectId: "project", scoreId: "score", revisionId, assigneeId: "reviewer" });
const close = (uid: string, requestId: string, status: string) =>
  change(uid, { action: "close", projectId: "project", requestId, status });

beforeEach(async () => {
  await resetFirestore();
  await project().set({});
  const score = getFirestore().collection("scores").doc("score");
  await score.set({ projectId: "project" });
  await Promise.all([
    ...["requester", "reviewer", "admin"].map((uid) =>
      project().collection("members").doc(uid).set({ role: uid === "admin" ? "admin" : "reviewer" })),
    ...["v1", "v2"].map((id) => score.collection("scoreRevisions").doc(id).set({})),
  ]);
});

it("prevents concurrent duplicates, isolates revisions, and keeps closed history", async () => {
  const results = await Promise.allSettled([request(), request()]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const [first] = (await requests().get()).docs;
  await request("requester", "v2");
  await close("reviewer", first.id, "commented");
  await expect(close("admin", first.id, "dismissed")).rejects.toMatchObject({ code: "failed-precondition" });
  await request();
  expect((await requests().get()).size).toBe(3);
  expect((await first.ref.get()).get("status")).toBe("commented");
});

it("only allows the assignee to submit an outcome, and either assignee or admin to dismiss", async () => {
  await expect(request("outsider")).rejects.toMatchObject({ code: "permission-denied" });
  await expect(request("requester", "missing")).rejects.toMatchObject({ code: "failed-precondition" });
  await request();
  const [first] = (await requests().get()).docs;
  await expect(close("requester", first.id, "dismissed")).rejects.toMatchObject({ code: "permission-denied" });
  await expect(close("admin", first.id, "approved")).rejects.toMatchObject({ code: "permission-denied" });
  await close("reviewer", first.id, "dismissed");
  await request();
  const [second] = (await requests().where("status", "==", "pending").get()).docs;
  await close("admin", second.id, "dismissed");
  expect((await second.ref.get()).get("status")).toBe("dismissed");
});
