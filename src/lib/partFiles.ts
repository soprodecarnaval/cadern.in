// File names of an exported score, shared by the exporter
// (scripts/lib/exportScore.ts) and the browser upload (scoreRender), so both
// produce the same Storage keys.
import type { Instrument } from "../../types/instrument";

export const safeFilename = (value: string): string => {
  const withoutControlCharacters = Array.from(value, (character) =>
    character.charCodeAt(0) < 32 ? "-" : character,
  ).join("");
  const safe = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/[ .]+$/g, "")
    .trim();
  return safe || "partitura";
};

/** `<title>-<instrument>`, with -a, -b, … when an instrument has several parts. */
export const buildPartBasenames = <Part extends { id: string; instrument: Instrument }>(
  title: string,
  parts: readonly Part[],
): Map<string, string> => {
  const totals = new Map<Instrument, number>();
  const seen = new Map<Instrument, number>();
  for (const part of parts) {
    totals.set(part.instrument, (totals.get(part.instrument) ?? 0) + 1);
  }

  return new Map(
    parts.map((part) => {
      const occurrence = (seen.get(part.instrument) ?? 0) + 1;
      seen.set(part.instrument, occurrence);
      const suffix =
        (totals.get(part.instrument) ?? 0) > 1
          ? `-${String.fromCharCode(96 + occurrence)}`
          : "";
      return [
        part.id,
        `${safeFilename(title)}-${safeFilename(part.instrument)}${suffix}`,
      ];
    }),
  );
};
