import { describe, expect, it } from "vitest";
import {
  partNameFromStem,
  stemFromPartName,
} from "./partNames";

describe("partNameFromStem", () => {
  // Both families below were taken from the real collection.
  it("strips a spaced-hyphen title prefix", () => {
    expect(partNameFromStem("olha pro céu - sax alto", "olha pro céu")).toBe(
      "sax alto",
    );
  });

  it("strips a slugified, underscored title prefix", () => {
    expect(partNameFromStem("a_banda_BONE_COM_PIRATA", "a banda")).toBe(
      "bone com pirata",
    );
  });

  it("matches the title case-insensitively", () => {
    expect(partNameFromStem("Cajuina_BONE_PIRATA", "cajuina")).toBe(
      "bone pirata",
    );
  });

  it("is idempotent — a second run finds no title to strip", () => {
    const once = partNameFromStem("olha pro céu - sax alto", "olha pro céu");
    expect(partNameFromStem(once, "olha pro céu")).toBe(once);
  });

  it("leaves a name alone when the title is not a prefix", () => {
    expect(partNameFromStem("Marchinha-trompete", "Marcha")).toBe(
      "Marchinha-trompete",
    );
  });

  it("never eats into the following word", () => {
    // Why there is no empty separator among the candidates.
    expect(partNameFromStem("a bandagem", "a banda")).toBe("a bandagem");
  });
});

describe("stemFromPartName", () => {
  it("restores a title prefix in the canonical form", () => {
    expect(stemFromPartName("sax alto", "olha pro céu")).toBe(
      "olha pro céu - sax alto",
    );
  });

  it("leaves names that already carry the title", () => {
    expect(stemFromPartName("olha pro céu - sax alto", "olha pro céu")).toBe(
      "olha pro céu - sax alto",
    );
  });
});
