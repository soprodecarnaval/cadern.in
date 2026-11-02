import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { clonePath, cloneValue } from "./cloneData";

const app = initializeApp({ projectId: "demo-clone" }, "clone-tests");
const db = getFirestore(app);
const mapping = { sourceBucket: "prod.bucket", targetBucket: "staging.bucket", sourceUid: "prod-user", targetUid: "staging-user" };
afterAll(() => deleteApp(app));

describe("clone mapping", () => {
  it("maps member paths, role map keys and attribution without changing score IDs or prose", () => {
    expect(clonePath("projects/band/members/prod-user", mapping)).toBe("projects/band/members/staging-user");
    expect(clonePath("scores/prod-user-song", mapping)).toBe("scores/prod-user-song");
    expect(cloneValue({ members: { "prod-user": "owner", other: "editor" }, memberIds: ["prod-user", "other"], uploadedBy: "prod-user", title: "prod-user song" }, mapping, db)).toEqual({
      members: { "staging-user": "owner", other: "editor" }, memberIds: ["staging-user", "other"], uploadedBy: "staging-user", title: "prod-user song",
    });
  });
  it("rewrites Firebase and GCS URLs, preserving tokens and object paths", () => {
    const urls = ["https://firebasestorage.googleapis.com/v0/b/prod.bucket/o/scores%2Fx?alt=media&token=secret", "gs://prod.bucket/scores/x", "https://storage.googleapis.com/prod.bucket/scores/x"];
    expect(cloneValue(urls, mapping, db)).toEqual(urls.map((url) => url.replace("prod.bucket", "staging.bucket")));
    expect(cloneValue("https://example.com/prod.bucket", mapping, db)).toBe("https://example.com/prod.bucket");
  });
  it("preserves Firestore scalar types and remaps document references", () => {
    const timestamp = Timestamp.fromMillis(123);
    const point = new GeoPoint(1, 2);
    const bytes = Buffer.from("test");
    const result = cloneValue({ timestamp, point, bytes, ref: db.doc("users/prod-user") }, mapping, db) as Record<string, unknown>;
    expect(result.timestamp).toBe(timestamp);
    expect(result.point).toBe(point);
    expect(result.bytes).toBe(bytes);
    expect((result.ref as { path: string }).path).toBe("users/staging-user");
  });
});
