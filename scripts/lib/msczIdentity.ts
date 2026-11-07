import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { readScoreXml } from "./msczArchive";
import type { ScoreIdentity } from "../../types/metajson";

// The score and version a .mscz was uploaded as, kept in the file so a later
// upload can tell a new version from a fork without guessing from the title.
const SCORE_ID_TAG = "cadernin-score-id";
const REVISION_ID_TAG = "cadernin-revision-id";

const parseScore = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const score = document.getElementsByTagName("Score").item(0);
  if (!score) {
    throw new Error("No Score element found in .mscx");
  }
  return { document, score };
};

/** `null` when the file was never stamped or carries only part of the ids. */
export const readMsczIdentity = (
  mscz: string | Buffer,
): ScoreIdentity | null => {
  const { document } = parseScore(readScoreXml(new AdmZip(mscz)).xml);
  const tag = (name: string) =>
    Array.from(document.getElementsByTagName("metaTag"))
      .find((node) => node.getAttribute("name") === name)
      ?.textContent?.trim();
  const scoreId = tag(SCORE_ID_TAG);
  const revisionId = tag(REVISION_ID_TAG);
  return scoreId && revisionId ? { scoreId, revisionId } : null;
};

/** The same archive with the identity written into its root score. */
export const stampMsczIdentity = (
  mscz: string | Buffer,
  identity: ScoreIdentity,
): Buffer => {
  const zip = new AdmZip(mscz);
  const entry = readScoreXml(zip);
  const { document, score } = parseScore(entry.xml);
  const tags: [string, string][] = [
    [SCORE_ID_TAG, identity.scoreId],
    [REVISION_ID_TAG, identity.revisionId],
  ];
  for (const [name, value] of tags) {
    const existing = Array.from(document.getElementsByTagName("metaTag")).find(
      (node) => node.getAttribute("name") === name,
    );
    const node = existing ?? document.createElement("metaTag");
    if (!existing) {
      node.setAttribute("name", name);
      score.appendChild(node);
    }
    node.textContent = value;
  }
  zip.updateFile(
    entry.name,
    Buffer.from(new XMLSerializer().serializeToString(document), "utf8"),
  );
  return zip.toBuffer();
};

/** Stamps a file in place; a failure leaves the original untouched. */
export const stampMsczFile = (
  msczPath: string,
  identity: ScoreIdentity,
): void => {
  const stamped = stampMsczIdentity(msczPath, identity);
  const temporaryPath = path.join(
    path.dirname(msczPath),
    `.${path.basename(msczPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(temporaryPath, stamped);
    fs.renameSync(temporaryPath, msczPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
};
