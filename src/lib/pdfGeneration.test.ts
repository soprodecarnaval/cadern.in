import { describe, expect, it } from "vitest";
import type {
  NumberedSongbookItemViewModel,
  PartViewModel,
  ScoreRevisionViewModel,
  ScoreViewModel,
  SongbookScoreViewModel,
} from "../../types/viewModels";
import { computeInstrumentStats, buildSongbookSections } from "./pdfGeneration";

const part = (instrument: PartViewModel["instrument"]): PartViewModel => ({
  name: instrument, instrument, svg: [], midi: "",
});

const revision = (parts: PartViewModel["instrument"][]): ScoreRevisionViewModel => ({
  id: "r", revisionNumber: 1, uploadedBy: "u", uploadedAt: null as never,
  mscz: "", metajson: "", midi: "", notes: "",
  parts: parts.map(part),
});

const score = (id: string, parts: PartViewModel["instrument"][]): ScoreViewModel => ({
  id, title: id, composer: "", sub: "", tags: [], projectId: "p", projectTitle: "P",
  latestRevision: revision(parts),
});

const item = (id: string, parts: PartViewModel["instrument"][], index: number, deleted = false): SongbookScoreViewModel & { index: number } => ({
  type: "score", score: score(id, parts), index, deleted,
});

describe("computeInstrumentStats", () => {
  it("counts scores per instrument and sorts by count descending", () => {
    const scores = [
      item("a", ["trompete", "trombone"], 1),
      item("b", ["trompete"], 2),
      item("c", ["sax alto"], 3),
    ];
    const { stats, totalScores } = computeInstrumentStats(scores);
    expect(totalScores).toBe(3);
    expect(stats.map((s) => s.instrument)).toEqual(["trompete", "trombone", "sax alto"]);
    expect(stats.find((s) => s.instrument === "trompete")?.count).toBe(2);
  });

  it("omits instruments with no parts and no fallback coverage", () => {
    const scores = [item("a", ["trompete"], 1)];
    const { stats } = computeInstrumentStats(scores);
    expect(stats.some((s) => s.instrument === "tuba")).toBe(false);
  });

  it("reports a higher countWithFallback for clarinete via sax tenor", () => {
    const scores = [
      item("a", ["clarinete"], 1),
      item("b", ["sax tenor"], 2),
    ];
    const { stats } = computeInstrumentStats(scores);
    const clarinete = stats.find((s) => s.instrument === "clarinete");
    expect(clarinete?.count).toBe(1);
    expect(clarinete?.countWithFallback).toBe(2);
  });
});

describe("buildSongbookSections", () => {
  it("puts leading scores into an untitled section before the first header", () => {
    const items: NumberedSongbookItemViewModel[] = [
      item("a", ["trompete"], 1),
      { type: "section", title: "Axé" },
      item("b", ["trompete"], 2),
    ];
    const sections = buildSongbookSections(items);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("");
    expect(sections[0].scores.map((s) => s.score.id)).toEqual(["a"]);
    expect(sections[1].title).toBe("Axé");
    expect(sections[1].scores.map((s) => s.score.id)).toEqual(["b"]);
  });

  it("preserves deletion markers and numbering", () => {
    const items: NumberedSongbookItemViewModel[] = [
      item("a", ["trompete"], 1, true),
    ];
    const sections = buildSongbookSections(items);
    expect(sections[0].scores[0]).toMatchObject({ index: 1, deleted: true });
  });

  it("returns no sections for an empty songbook", () => {
    expect(buildSongbookSections([])).toEqual([]);
  });
});
