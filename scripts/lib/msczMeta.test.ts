import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { copyMsczWithMeta, writeMetaTags } from "./msczMeta";

const temporaryDirectories: string[] = [];

const makeArchive = (xml: string): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mscz-meta-"));
  temporaryDirectories.push(directory);
  const archivePath = path.join(directory, "source.mscz");
  const zip = new AdmZip();
  zip.addFile("score.mscx", Buffer.from(xml));
  zip.addFile("META-INF/container.xml", Buffer.from("preserve me"));
  zip.writeZip(archivePath);
  return archivePath;
};

const readScoreXml = (archivePath: string): string => {
  const entry = new AdmZip(archivePath).getEntry("score.mscx");
  if (!entry) {
    throw new Error("Missing score.mscx");
  }
  return entry.getData().toString("utf8");
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("writeMetaTags", () => {
  it("copies metadata into the main score of an archive with 12 excerpts", () => {
    const sourcePath = makeArchive("<museScore><Score /></museScore>");
    const zip = new AdmZip(sourcePath);
    const excerptXml = '<museScore><Score><metaTag name="workTitle">Part</metaTag></Score></museScore>';
    const excerptNames = Array.from(
      { length: 12 },
      (_, index) => `Excerpts/Excerpt-${index + 1}/part.mscx`,
    );
    for (const name of excerptNames) {
      zip.addFile(name, Buffer.from(excerptXml));
    }
    zip.updateFile("META-INF/container.xml", Buffer.from(
      '<container><rootfiles>' +
        [...excerptNames, "score.mscx"].map(
          (name) => `<rootfile full-path="${name}"/>`,
        ).join("") +
        '</rootfiles></container>',
    ));
    zip.writeZip(sourcePath);
    const sourceBefore = fs.readFileSync(sourcePath);
    const destinationPath = path.join(path.dirname(sourcePath), "copy.mscz");

    copyMsczWithMeta(sourcePath, destinationPath, {
      title: "Updated title",
      composer: "Updated composer",
      previousSource: "",
      poet: "",
    });

    expect(readScoreXml(destinationPath)).toContain(
      '<metaTag name="workTitle">Updated title</metaTag>',
    );
    expect(fs.readFileSync(sourcePath)).toEqual(sourceBefore);
    const copied = new AdmZip(destinationPath);
    for (const entry of zip.getEntries()) {
      if (entry.entryName !== "score.mscx") {
        expect(copied.getEntry(entry.entryName)?.getData()).toEqual(entry.getData());
      }
    }
  });

  it("updates existing tags and inserts missing tags", () => {
    const archivePath = makeArchive(
      '<?xml version="1.0"?><museScore><Score>' +
        '<metaTag name="workTitle">Old title</metaTag>' +
        '<metaTag name="composer">Old composer</metaTag>' +
        '<VBox><Text><style>title</style><text>Old title</text></Text>' +
        '<Text><style>composer</style><text>Old composer</text></Text></VBox>' +
        "</Score></museScore>",
    );

    writeMetaTags(archivePath, {
      title: "Canção & Marcha",
      composer: "José <Silva>",
      previousSource: "Trecho 2",
      poet: "junina, arrasta-pé",
    });

    const xml = readScoreXml(archivePath);
    expect(xml).toContain(
      '<metaTag name="workTitle">Canção &amp; Marcha</metaTag>',
    );
    expect(xml).toContain(
      '<metaTag name="composer">José &lt;Silva&gt;</metaTag>',
    );
    expect(xml).toContain(
      '<Text><style>title</style><text>Canção &amp; Marcha</text></Text>',
    );
    expect(xml).toContain(
      '<Text><style>composer</style><text>José &lt;Silva&gt;</text></Text>',
    );
    expect(xml).toContain('<metaTag name="source">Trecho 2</metaTag>');
    expect(xml).toContain(
      '<metaTag name="lyricist">junina, arrasta-pé</metaTag>',
    );
    expect(
      new AdmZip(archivePath)
        .getEntry("META-INF/container.xml")
        ?.getData()
        .toString("utf8"),
    ).toBe("preserve me");
  });

  it("creates a metadata copy without changing the source", () => {
    const sourcePath = makeArchive("<museScore><Score /></museScore>");
    const sourceBefore = fs.readFileSync(sourcePath);
    const destinationPath = path.join(path.dirname(sourcePath), "copy.mscz");

    copyMsczWithMeta(sourcePath, destinationPath, {
      title: "New title",
      composer: "Composer",
      previousSource: "",
      poet: "tag",
    });

    expect(fs.readFileSync(sourcePath)).toEqual(sourceBefore);
    expect(readScoreXml(destinationPath)).toContain(
      '<metaTag name="workTitle">New title</metaTag>',
    );
  });
});
