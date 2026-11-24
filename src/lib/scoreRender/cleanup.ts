// Clean-up of part MusicXML before rendering: what the caderninhoFormatter
// plugin's "Limpar caixas de texto" and "Limpar piratas" steps removed in
// MuseScore. Contributors no longer clean files by hand.
//
// Only DOM Level 2 calls are used (childNodes, removeChild), so the transforms
// run on the browser's DOM and on @xmldom/xmldom in tests.

export type CleanupOptions = {
  /** Title frames: `<credit>`, work and movement titles, creators. createSongBook draws the header. */
  credits: boolean;
  /** Existing `<fingering>`; the piratas are added again by the formatter (008). */
  fingerings: boolean;
  /** Staff text (`<direction>` with only `<words>`), keeping tempo, jumps, segno/coda and expressions. */
  staffText: boolean;
};

export const DEFAULT_CLEANUP: Readonly<CleanupOptions> = Object.freeze({
  credits: true,
  fingerings: true,
  staffText: true,
});

export type PartCleanup = {
  /** MusicXML part id. */
  partId: string;
  fingerings: number;
  /** Text of each staff text removed, in order. */
  staffText: string[];
};

export type CleanupReport = {
  /** Header elements removed: credits, titles and creators. */
  credits: string[];
  parts: PartCleanup[];
};

type XmlNode = Node;

const elements = (parent: XmlNode): Element[] =>
  Array.from(parent.childNodes).filter(
    (node): node is Element => node.nodeType === 1,
  );
const named = (parent: XmlNode, name: string): Element[] =>
  elements(parent).filter((element) => element.localName === name);
const descendants = (parent: Element | Document, name: string): Element[] =>
  Array.from(parent.getElementsByTagName(name));
const remove = (node: XmlNode) => node.parentNode?.removeChild(node);
const text = (node: XmlNode): string =>
  (node.textContent ?? "").replace(/\s+/g, " ").trim();

// Markings MuseScore writes as words that must survive: jumps and their targets.
const JUMP_TEXT =
  /\b(d\.?\s?c\.?|d\.?\s?s\.?|da\s+capo|dal\s+segno|fine|coda|segno)\b|<sym>\s*(coda|segno)/i;
// <sound> attributes of system-wide markings (tempo, jumps).
const SYSTEM_SOUND = ["tempo", "dacapo", "dalsegno", "fine", "tocoda", "segno", "coda"];

/**
 * Staff text: a direction made of words only, with no tempo or jump sound,
 * whose words are not a jump. Italic words are kept as expression text
 * (MuseScore's "Expressão" style), which the plugin did not remove either.
 */
const isStaffText = (direction: Element): boolean => {
  const types = named(direction, "direction-type");
  const marks = types.flatMap(elements);
  if (!marks.length || marks.some((mark) => mark.localName !== "words")) {
    return false;
  }
  if (marks.some((mark) => mark.getAttribute("font-style") === "italic")) {
    return false;
  }
  const sound = named(direction, "sound")[0];
  if (sound && SYSTEM_SOUND.some((name) => sound.hasAttribute(name))) {
    return false;
  }
  return !marks.some((mark) => JUMP_TEXT.test(text(mark)));
};

const SYMBOLS: Record<string, string> = { coda: "Coda", segno: "Segno" };

/** Text without MuseScore rich-text tags; <sym>coda</sym> and <sym>segno</sym> become words. */
export const withoutMarkup = (value: string): string =>
  value
    .replace(/<sym>\s*([a-zA-Z]+)\s*<\/sym>/g, (_whole, name: string) => SYMBOLS[name] ?? "")
    .replace(/<\/?(?:font|b|i|u|s|sub|sup)\b[^>]*\/?>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

/** Remove an element, and its parent too when nothing else is left in it. */
const prune = (element: Element, stopAt: string) => {
  let node: Element | null = element;
  while (node) {
    const parent = node.parentNode as Element | null;
    remove(node);
    if (!parent || parent.localName === stopAt || elements(parent).length) {
      return;
    }
    node = parent;
  }
};

/** Apply the clean-up to a partwise MusicXML document in place. */
export function cleanupMusicXml(
  document: Document,
  options: Partial<CleanupOptions> = {},
): CleanupReport {
  const settings = { ...DEFAULT_CLEANUP, ...options };
  const root = document.documentElement;
  const report: CleanupReport = { credits: [], parts: [] };
  if (settings.credits) {
    const header = [
      ...named(root, "credit"),
      ...named(root, "work"),
      ...named(root, "movement-title"),
      ...named(root, "movement-number"),
      ...named(root, "identification").flatMap((id) => named(id, "creator")),
    ];
    for (const element of header) {
      const type = element.getAttribute("type");
      const words =
        element.localName === "credit"
          ? named(element, "credit-words").map(text).join(" ")
          : text(element);
      report.credits.push(`${element.localName}${type ? `:${type}` : ""}: ${words}`);
      remove(element);
    }
  }
  for (const part of named(root, "part")) {
    const result: PartCleanup = {
      partId: part.getAttribute("id") ?? "",
      fingerings: 0,
      staffText: [],
    };
    if (settings.fingerings) {
      for (const fingering of descendants(part, "fingering")) {
        prune(fingering, "note");
        result.fingerings++;
      }
    }
    if (settings.staffText) {
      for (const direction of descendants(part, "direction").filter(isStaffText)) {
        result.staffText.push(text(direction));
        remove(direction);
      }
    }
    // MuseScore writes its rich-text markup into <words> ("<font size=\"9.82\"/>D.S.");
    // the renderer would print it. Always cleaned, after staff text was recognized.
    for (const words of descendants(part, "words")) {
      const value = words.textContent ?? "";
      const plain = withoutMarkup(value);
      if (plain !== value) {words.textContent = plain;}
    }
    report.parts.push(result);
  }
  return report;
}

/** `cleanupMusicXml` on MusicXML text. */
export function cleanupMusicXmlText(
  musicXml: string,
  options: Partial<CleanupOptions> = {},
  xml: { parse: (text: string) => Document; serialize: (document: Document) => string } = {
    parse: (value) => new DOMParser().parseFromString(value, "application/xml"),
    serialize: (document) => new XMLSerializer().serializeToString(document),
  },
): { musicXml: string; report: CleanupReport } {
  const document = xml.parse(musicXml);
  const report = cleanupMusicXml(document, options);
  return { musicXml: xml.serialize(document), report };
}
