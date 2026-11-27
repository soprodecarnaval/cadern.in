import { describe, expect, it } from "vitest";
import type { ScoreViewModel } from "../../types/viewModels";
import { songbookScore, songbookSection } from "../lib/songbook";
import { generateSectionsByStyle } from "./songBookRows";

const score = (id: string, style: string) =>
  songbookScore({ id, tags: [style] } as ScoreViewModel);

describe("generateSectionsByStyle", () => {
  it("groups spelling variants of the same style without recreating score rows", () => {
    const first = score("a", "Frevo");
    const other = score("b", "Samba");
    const last = score("c", " frevo ");
    const grouped = generateSectionsByStyle([first, other, last]);

    expect(grouped).toEqual([
      songbookSection("Frevo"), first, last, songbookSection("Samba"), other,
    ]);
    expect(grouped[2]).toBe(last);
    expect(generateSectionsByStyle(grouped)).toEqual(grouped);
  });
});
