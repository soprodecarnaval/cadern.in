import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Node as XmlNode } from "@xmldom/xmldom";
import { readScoreXml } from "./msczArchive";

export interface MetadataTags {
  title: string;
  composer: string;
  previousSource: string;
  poet: string;
}

const TAG_NAMES: Array<[keyof MetadataTags, string]> = [
  ["title", "workTitle"],
  ["composer", "composer"],
  ["previousSource", "source"],
  ["poet", "lyricist"],
];

const replaceText = (node: XmlNode, value: string): void => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
  node.appendChild(node.ownerDocument!.createTextNode(value));
};

const findScoreDocument = readScoreXml;

const updateXml = (xml: string, tags: MetadataTags): string => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parserErrors = document.getElementsByTagName("parsererror");
  if (parserErrors.length > 0) {
    throw new Error("Invalid .mscx XML");
  }
  const score = document.getElementsByTagName("Score").item(0);
  if (!score) {
    throw new Error("No Score element found in .mscx");
  }

  for (const [key, tagName] of TAG_NAMES) {
    const existing = Array.from(document.getElementsByTagName("metaTag")).find(
      (node) => node.getAttribute("name") === tagName,
    );
    const node = existing ?? document.createElement("metaTag");
    if (!existing) {
      node.setAttribute("name", tagName);
      score.appendChild(node);
    }
    replaceText(node, tags[key]);
  }

  for (const textFrame of Array.from(document.getElementsByTagName("Text"))) {
    const style = Array.from(textFrame.childNodes).find(
      (node) => node.nodeName === "style",
    );
    const text = Array.from(textFrame.childNodes).find(
      (node) => node.nodeName === "text",
    );
    if (style?.textContent === "title" && text) {
      replaceText(text, tags.title);
    } else if (style?.textContent === "composer" && text) {
      replaceText(text, tags.composer);
    }
  }

  return new XMLSerializer().serializeToString(document);
};

export const writeMetaTags = (msczPath: string, tags: MetadataTags): void => {
  const zip = new AdmZip(msczPath);
  const score = findScoreDocument(zip);
  zip.updateFile(score.name, Buffer.from(updateXml(score.xml, tags), "utf8"));

  const temporaryPath = path.join(
    path.dirname(msczPath),
    `.${path.basename(msczPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    zip.writeZip(temporaryPath);
    fs.copyFileSync(temporaryPath, msczPath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }
};

export const copyMsczWithMeta = (
  sourcePath: string,
  destinationPath: string,
  tags: MetadataTags,
): string => {
  fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
  try {
    writeMetaTags(destinationPath, tags);
  } catch (error) {
    fs.unlinkSync(destinationPath);
    throw error;
  }
  return destinationPath;
};
