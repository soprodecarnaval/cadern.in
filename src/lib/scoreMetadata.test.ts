import { describe, expect, it } from "vitest";
import { resolveScoreMetadata, uploadedScoreMetadata } from "./scoreMetadata";

const legacy = { title: "Old", composer: "C", sub: "S", tags: ["a"] };
const cached = { title: "New", composer: "C2", sub: "S2", tags: ["b"] };

describe("uploadedScoreMetadata", () => {
  it("prefers the cached revision metadata over legacy fields", () => {
    expect(uploadedScoreMetadata({ ...legacy, cachedMetadata: cached })).toEqual(
      cached,
    );
    expect(uploadedScoreMetadata(legacy)).toEqual(legacy);
  });
});

describe("resolveScoreMetadata", () => {
  it("applies the override field by field", () => {
    expect(
      resolveScoreMetadata({
        ...legacy,
        cachedMetadata: cached,
        metadataOverride: { composer: "Fixed" },
      }),
    ).toEqual({ ...cached, composer: "Fixed" });
  });

  it("keeps an override that empties a field", () => {
    expect(
      resolveScoreMetadata({ ...legacy, metadataOverride: { sub: "", tags: [] } }),
    ).toEqual({ ...legacy, sub: "", tags: [] });
  });
});
