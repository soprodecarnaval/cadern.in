import { describe, expect, it } from "vitest";
import { recoverScoreMetaStdout } from "./scoreMeta";

describe("recoverScoreMetaStdout", () => {
  it("recovers valid metadata printed before a MuseScore shutdown crash", () => {
    const stdout = Buffer.from(
      'log noise\n{"metadata":{"title":"Canção"}}\n',
    );

    expect(recoverScoreMetaStdout({ stdout })).toBe(stdout.toString("utf8"));
  });

  it("does not recover invalid process output", () => {
    expect(recoverScoreMetaStdout({ stdout: "mutex lock failed" })).toBe(
      undefined,
    );
  });
});
