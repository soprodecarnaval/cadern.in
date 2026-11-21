import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readMsczIdentity } from "../../scripts/lib/msczIdentity";
import { inspect } from "./browserScore/input";
import {
  REVISION_ID_TAG,
  SCORE_ID_TAG,
  readMsczIdentityBytes,
  stampMsczIdentityBytes,
} from "./msczIdentity";

const IDENTITY = { scoreId: "acervo-eva", revisionId: "eva-20261031T120000-a1b2" };
const score = new Uint8Array(
  readFileSync(new URL("../../test-scores/all-instruments.mscz", import.meta.url)),
);

describe("mscz identity on bytes", () => {
  it("is null on a file that was never stamped", () => {
    expect(readMsczIdentityBytes(score)).toBeNull();
  });

  it("round-trips through the Node reader and the browser-score library", () => {
    const stamped = stampMsczIdentityBytes(score, IDENTITY);
    expect(readMsczIdentityBytes(stamped)).toEqual(IDENTITY);
    expect(readMsczIdentity(Buffer.from(stamped))).toEqual(IDENTITY);
    const { metaTags, scoreParts } = inspect(stamped, "mscz");
    expect(metaTags[SCORE_ID_TAG]).toBe(IDENTITY.scoreId);
    expect(metaTags[REVISION_ID_TAG]).toBe(IDENTITY.revisionId);
    expect(scoreParts).toHaveLength(19);
  });

  it("keeps every other entry byte for byte and in order", () => {
    const before = unzipSync(score);
    const after = unzipSync(stampMsczIdentityBytes(score, IDENTITY));
    expect(Object.keys(after)).toEqual(Object.keys(before));
    for (const name of Object.keys(before)) {
      if (name === "all-instruments.mscx") {continue;}
      expect(Buffer.from(after[name]).equals(Buffer.from(before[name])), name).toBe(true);
    }
    const text = new TextDecoder().decode(after["all-instruments.mscx"]);
    expect(text).toContain(`<metaTag name="${SCORE_ID_TAG}">${IDENTITY.scoreId}</metaTag>`);
    expect(text).toContain('<metaTag name="workTitle">');
  });

  it("replaces an earlier identity instead of adding a second one", () => {
    const next = { scoreId: "garota-eva", revisionId: "eva-2" };
    const stamped = stampMsczIdentityBytes(stampMsczIdentityBytes(score, IDENTITY), next);
    expect(readMsczIdentityBytes(stamped)).toEqual(next);
    const text = new TextDecoder().decode(unzipSync(stamped)["all-instruments.mscx"]);
    expect(text.match(/cadernin-score-id/g)).toHaveLength(1);
  });
});
