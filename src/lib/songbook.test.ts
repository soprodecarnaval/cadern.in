import { describe, expect, it } from "vitest";
import type { ScoreViewModel } from "../../types/viewModels";
import {
  fromSongbookRevision,
  songbookScore,
  songbookSection,
  toSongbookRevisionContent,
} from "./songbook";

const score = (id: string, revisionId = `${id}-r1`) =>
  ({
    id,
    title: id,
    latestRevision: { id: revisionId },
  }) as unknown as ScoreViewModel;

describe("toSongbookRevisionContent", () => {
  it("numbers scores only and pins each to its shown revision", () => {
    const content = toSongbookRevisionContent([
      songbookSection("Marchinhas"),
      songbookScore(score("a")),
      songbookScore(score("b", "b-r7")),
      songbookSection("Sambas"),
      songbookScore(score("c")),
    ]);
    expect(content.entries).toEqual([
      { type: "section", title: "Marchinhas", order: 0 },
      { type: "score", scoreId: "a", order: 1, index: 1 },
      { type: "score", scoreId: "b", order: 2, index: 2 },
      { type: "section", title: "Sambas", order: 3 },
      { type: "score", scoreId: "c", order: 4, index: 3 },
    ]);
    expect(content.pins).toEqual({ a: "a-r1", b: "b-r7", c: "c-r1" });
    expect(content.covers).toEqual({});
  });

  it("rejects a score that appears twice", () => {
    expect(() =>
      toSongbookRevisionContent([
        songbookScore(score("a")),
        songbookScore(score("a")),
      ]),
    ).toThrow();
  });
});

describe("fromSongbookRevision", () => {
  it("restores list order and skips scores it can't find", () => {
    const a = score("a");
    const items = fromSongbookRevision(
      {
        entries: [
          { type: "score", scoreId: "missing", order: 2, index: 2 },
          { type: "score", scoreId: "a", order: 1, index: 1 },
          { type: "section", title: "S", order: 0 },
        ],
      },
      new Map([["a", a]]),
    );
    expect(items).toEqual([songbookSection("S"), songbookScore(a)]);
  });
});
