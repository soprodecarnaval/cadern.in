import type { ReactNode } from "react";

/** [start, end] character ranges, end inclusive (matches Fuse's RangeTuple). */
export type HighlightRanges = readonly (readonly [number, number])[];

/** Wraps the given character ranges of `text` in <mark>. */
export function highlightRanges(text: string, ranges?: HighlightRanges): ReactNode {
  if (!ranges || ranges.length === 0) {
    return text;
  }
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach(([start, end], i) => {
    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }
    if (end + 1 > cursor) {
      parts.push(<mark key={i}>{text.slice(Math.max(start, cursor), end + 1)}</mark>);
      cursor = end + 1;
    }
  });
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

// Combining diacritical marks, U+0300 - U+036F.
const COMBINING_DIACRITICS = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g",
);
const normalize = (s: string) =>
  s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(COMBINING_DIACRITICS, "");

/** The single range where `needle` (case/diacritic-insensitive) appears in `text`, if any. */
export function substringRange(text: string, needle: string): HighlightRanges {
  const trimmed = needle.trim();
  if (!trimmed) {
    return [];
  }
  // Normalizing can change string length (rare, e.g. ligatures) — search in
  // the normalized string but report the range against the original `text`,
  // which is safe here since Portuguese diacritic stripping is 1:1 per char.
  const idx = normalize(text).indexOf(normalize(trimmed));
  return idx === -1 ? [] : [[idx, idx + trimmed.length - 1]];
}
