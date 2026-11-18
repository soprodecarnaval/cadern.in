import type { ReactNode } from "react";

/** [start, end] character ranges, end inclusive (matches Fuse's RangeTuple). */
export type HighlightRanges = readonly (readonly [number, number])[];

/** Wraps the given character ranges of `text` in <mark>. */
export function highlightRanges(text: string, ranges?: HighlightRanges): ReactNode {
  if (!ranges || ranges.length === 0) {
    return text;
  }
  // Ranges that touch or overlap become one mark, so a word isn't drawn as
  // several separate highlights.
  const merged: [number, number][] = [];
  [...ranges].sort((a, b) => a[0] - b[0]).forEach(([start, end]) => {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  });
  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
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

/** Where each word of `query` appears in `text`, case/diacritic-insensitive.
 *  Search syntax around a word (quotes, ^, =, ', $) is ignored, and words
 *  negated with ! are skipped. */
export function queryRanges(text: string, query: string): HighlightRanges {
  return query
    .split(/\s+/)
    .filter((word) => word && !word.startsWith("!"))
    .map((word) => word.replace(/^[="'^]+|[$"]+$/g, ""))
    .flatMap((word) => substringRange(text, word));
}
