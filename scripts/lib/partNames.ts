/**
 * Legacy part names embed the song title, in one of two families seen in the
 * collection (5894 parts surveyed):
 *
 *   "olha pro céu - sax alto"     title + " - " + part      (2119)
 *   "a_banda_BONE_COM_PIRATA"     slug(title) + "_" + PART  (3775)
 *
 * so the separator and the title's own punctuation both vary. Candidate
 * prefixes are tried longest-first and compared case-insensitively.
 *
 * There is deliberately no empty separator among them: it would let a title
 * eat into the following word ("a bandagem" -> "gem"), and the survey showed
 * it was never needed.
 */
export function partNameFromStem(stem: string, title: string): string {
  const titleForms = new Set([
    title,
    title.replace(/\s+/g, "_"),
    title.replace(/\s+/g, "-"),
  ]);
  const separators = [" - ", "-", "_", " "];

  let matched = "";
  for (const form of titleForms) {
    for (const separator of separators) {
      const prefix = `${form}${separator}`;
      if (
        prefix.length > matched.length &&
        stem.toLowerCase().startsWith(prefix.toLowerCase())
      ) {
        matched = prefix;
      }
    }
  }
  if (matched === "") {
    return stem;
  }

  return stem
    .slice(matched.length)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * `down` reconstructs rather than restores. The original stem cannot be
 * recovered from Storage paths — those are slugified independently of the name
 * ("a hard days night - flauta" is stored at ".../a-hard-days-night-flauta.midi")
 * — and the original separator was not recorded. Names come back in the " - "
 * form, which renders identically but is not byte-for-byte the input.
 */
export function stemFromPartName(name: string, title: string): string {
  return name.toLowerCase().startsWith(title.toLowerCase())
    ? name
    : `${title} - ${name}`;
}
