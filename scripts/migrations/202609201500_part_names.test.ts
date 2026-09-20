import { describe, expect, it } from "vitest";
import {
  partNameFromStem,
  stemFromMidiPath,
} from "./202609201500_part_names";

describe("partNameFromStem", () => {
  it("drops the song title and reads as a part name", () => {
    expect(partNameFromStem("cadern.in test-trompete-a", "cadern.in test")).toBe(
      "trompete a",
    );
  });

  it("keeps instrument names that already contain a space", () => {
    expect(partNameFromStem("Marcha-tuba eb", "Marcha")).toBe("tuba eb");
  });

  it("handles a title whose slash was rewritten by safeFilename", () => {
    expect(partNameFromStem("A-B-flauta", "A/B")).toBe("flauta");
  });

  it("is idempotent — a second run finds no title to strip", () => {
    const once = partNameFromStem("Marcha-trompete-a", "Marcha");
    expect(partNameFromStem(once, "Marcha")).toBe(once);
  });

  it("leaves a name alone when the title is not an exact prefix", () => {
    // Fuzzy matching here would silently corrupt names, and this runs once.
    expect(partNameFromStem("Marchinha-trompete", "Marcha")).toBe(
      "Marchinha-trompete",
    );
  });
});

describe("stemFromMidiPath", () => {
  it("recovers the original stem, which makes down exact", () => {
    expect(
      stemFromMidiPath("songs/proj-marcha/1/parts/Marcha-trompete-a.midi"),
    ).toBe("Marcha-trompete-a");
  });

  it("returns undefined for a path it does not recognise", () => {
    expect(stemFromMidiPath("songs/proj-marcha/1/score.midi")).toBeUndefined();
  });
});
