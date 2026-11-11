import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import { highlightRanges, substringRange } from "./highlight";

function textOf(node: ReturnType<typeof highlightRanges>): string {
  if (typeof node === "string") { return node; }
  if (Array.isArray(node)) { return node.map(textOf).join(""); }
  if (isValidElement<{ children?: unknown }>(node)) {
    return textOf(node.props.children as ReturnType<typeof highlightRanges>);
  }
  return "";
}

function marks(node: ReturnType<typeof highlightRanges>): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(marks);
  }
  if (isValidElement<{ children?: unknown }>(node) && node.type === "mark") {
    return [textOf(node.props.children as ReturnType<typeof highlightRanges>)];
  }
  return [];
}

describe("highlightRanges", () => {
  it("returns the plain string when there are no ranges", () => {
    expect(highlightRanges("Olha pro Céu", undefined)).toBe("Olha pro Céu");
    expect(highlightRanges("Olha pro Céu", [])).toBe("Olha pro Céu");
  });

  it("wraps a single matched range in <mark>, preserving surrounding text", () => {
    const result = highlightRanges("Olha pro Céu", [[5, 7]]);
    expect(textOf(result)).toBe("Olha pro Céu");
    expect(marks(result)).toEqual(["pro"]);
  });

  it("wraps multiple non-overlapping ranges", () => {
    const result = highlightRanges("Olha pro Céu", [[9, 11], [0, 3]]);
    expect(marks(result)).toEqual(["Olha", "Céu"]);
  });
});

describe("substringRange", () => {
  it("finds a case/diacritic-insensitive match", () => {
    expect(substringRange("Olha pro Céu", "ceu")).toEqual([[9, 11]]);
    expect(substringRange("Olha pro Céu", "OLHA")).toEqual([[0, 3]]);
  });

  it("returns no ranges for an empty needle or no match", () => {
    expect(substringRange("Olha pro Céu", "")).toEqual([]);
    expect(substringRange("Olha pro Céu", "   ")).toEqual([]);
    expect(substringRange("Olha pro Céu", "xyz")).toEqual([]);
  });
});
