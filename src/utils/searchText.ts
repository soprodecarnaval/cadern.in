/** Lowercase, without accents: "Código" matches "codigo". */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Whether every word of the query appears somewhere in the text. */
export function matchesEveryWord(query: string, text: string): boolean {
  const haystack = normalizeSearchText(text);
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
