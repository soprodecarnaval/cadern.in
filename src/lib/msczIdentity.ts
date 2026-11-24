// The score and version a .mscz was uploaded as, kept in the file so a later
// upload can tell a new version from a fork without guessing from the title.
// Works on bytes, in the browser and in Node; scripts/lib/msczIdentity.ts wraps
// it for files and Buffers.
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { ScoreIdentity } from "../../types/metajson";

export const SCORE_ID_TAG = "cadernin-score-id";
export const REVISION_ID_TAG = "cadernin-revision-id";

/** Store an uncompressed MuseScore document in the same archive format as an .mscz upload. */
export function packageMscx(bytes: Uint8Array): Uint8Array {
  return zipSync({
    "META-INF/container.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.mscx"/></rootfiles></container>',
    ),
    "score.mscx": bytes,
  });
}

// A .mscz is a zip. META-INF/container.xml lists the packaged files as
// <rootfile full-path="..."/>, including the score, whose name follows the
// document name. Saved parts are .mscx files under Excerpts/; only the .mscx
// outside Excerpts/ is the full score.
const isScoreEntry = (name: string): boolean =>
  name.endsWith(".mscx") && !name.startsWith("Excerpts/");

const rootScoreEntryName = (files: Record<string, Uint8Array>): string => {
  const container = files["META-INF/container.xml"];
  const declared = container
    ? Array.from(
        strFromU8(container).matchAll(/<rootfile\s+full-path="([^"]+)"/g),
        (match) => match[1],
      ).filter(isScoreEntry)
    : [];
  const name = declared[0] ?? Object.keys(files).find(isScoreEntry);
  if (!name) {
    throw new Error("Not a MuseScore file: no .mscx found inside the archive");
  }
  if (!files[name]) {
    throw new Error(`Archive declares ${name} but does not contain it`);
  }
  return name;
};

const parseScore = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const score = document.getElementsByTagName("Score").item(0);
  if (!score) {
    throw new Error("No Score element found in .mscx");
  }
  return { document, score };
};

const metaTag = (document: ReturnType<typeof parseScore>["document"], name: string) =>
  Array.from(document.getElementsByTagName("metaTag")).find(
    (node) => node.getAttribute("name") === name,
  );

/** `null` when the file was never stamped or carries only part of the ids. */
export const readMsczIdentityBytes = (
  mscz: Uint8Array,
): ScoreIdentity | null => {
  const files = unzipSync(mscz);
  const { document } = parseScore(strFromU8(files[rootScoreEntryName(files)]));
  const scoreId = metaTag(document, SCORE_ID_TAG)?.textContent?.trim();
  const revisionId = metaTag(document, REVISION_ID_TAG)?.textContent?.trim();
  return scoreId && revisionId ? { scoreId, revisionId } : null;
};

/**
 * The same archive with the identity written into its root score. Every other
 * entry keeps its contents byte for byte, in the same order.
 */
export const stampMsczIdentityBytes = (
  mscz: Uint8Array,
  identity: ScoreIdentity,
): Uint8Array => {
  const files = unzipSync(mscz);
  const name = rootScoreEntryName(files);
  const { document, score } = parseScore(strFromU8(files[name]));
  for (const [tag, value] of [
    [SCORE_ID_TAG, identity.scoreId],
    [REVISION_ID_TAG, identity.revisionId],
  ] as const) {
    const existing = metaTag(document, tag);
    const node = existing ?? document.createElement("metaTag");
    if (!existing) {
      node.setAttribute("name", tag);
      score.appendChild(node);
    }
    node.textContent = value;
  }
  const stamped = strToU8(new XMLSerializer().serializeToString(document));
  const entries: Zippable = {};
  for (const [entry, bytes] of Object.entries(files)) {
    entries[entry] = entry === name ? stamped : bytes;
  }
  return zipSync(entries, { level: 6 });
};
