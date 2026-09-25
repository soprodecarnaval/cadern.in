import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSupportedMscz,
  findRootScoreEntryName,
  parseMsczVersion,
  readMsczVersion,
} from "./msczArchive";

const temporaryDirectories: string[] = [];

const scoreXml = (programVersion = "4.7.2", formatVersion = "4.70") =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<museScore version="${formatVersion}">\n` +
  `  <programVersion>${programVersion}</programVersion>\n` +
  `  <Score><metaTag name="workTitle">t</metaTag></Score>\n` +
  `</museScore>`;

const containerXml = (paths: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><container><rootfiles>` +
  paths.map((p) => `<rootfile full-path="${p}"/>`).join("") +
  `</rootfiles></container>`;

/** Writes a .mscz. `files` maps entry name to contents. */
const makeArchive = (files: Record<string, string>): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mscz-archive-"));
  temporaryDirectories.push(directory);
  const archivePath = path.join(directory, "score.mscz");
  const zip = new AdmZip();
  for (const [name, contents] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(contents));
  }
  zip.writeZip(archivePath);
  return archivePath;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("findRootScoreEntryName", () => {
  it("resolves the score named by container.xml", () => {
    // The .mscx name tracks the document name, so it cannot be hardcoded.
    const archive = makeArchive({
      "score_style.mss": "style",
      "Paisagem da Janela.mscx": scoreXml(),
      "META-INF/container.xml": containerXml([
        "score_style.mss",
        "Paisagem da Janela.mscx",
      ]),
    });

    expect(findRootScoreEntryName(new AdmZip(archive))).toBe(
      "Paisagem da Janela.mscx",
    );
  });

  it("ignores per-part scores under Excerpts/", () => {
    // MuseScore writes one .mscx per generated part once parts are saved.
    const archive = makeArchive({
      "teste.mscx": scoreXml(),
      "Excerpts/Excerpt-1/trompete.mscx": scoreXml(),
      "Excerpts/Excerpt-2/trombone.mscx": scoreXml(),
      "META-INF/container.xml": containerXml([
        "teste.mscx",
        "Excerpts/Excerpt-1/trompete.mscx",
        "Excerpts/Excerpt-2/trombone.mscx",
      ]),
    });

    expect(findRootScoreEntryName(new AdmZip(archive))).toBe("teste.mscx");
  });

  it("falls back to scanning when container.xml is absent", () => {
    const archive = makeArchive({ "teste.mscx": scoreXml() });

    expect(findRootScoreEntryName(new AdmZip(archive))).toBe("teste.mscx");
  });

  it("rejects an archive with no score in it", () => {
    const archive = makeArchive({ "notes.txt": "hello" });

    expect(() => findRootScoreEntryName(new AdmZip(archive))).toThrow(
      /no \.mscx found/,
    );
  });
});

describe("parseMsczVersion", () => {
  it("reads both the format and program versions", () => {
    expect(parseMsczVersion(scoreXml("4.7.2", "4.70"))).toEqual({
      format: "4.70",
      program: "4.7.2",
    });
  });

  it("tolerates a missing programVersion", () => {
    expect(
      parseMsczVersion('<museScore version="3.01"><Score/></museScore>'),
    ).toEqual({ format: "3.01", program: undefined });
  });
});

describe("assertSupportedMscz", () => {
  it("accepts a MuseScore 4 score", () => {
    const archive = makeArchive({
      "teste.mscx": scoreXml("4.7.2"),
      "META-INF/container.xml": containerXml(["teste.mscx"]),
    });

    expect(() => assertSupportedMscz(archive)).not.toThrow();
  });

  it("rejects a MuseScore 3 score with an actionable message", () => {
    const archive = makeArchive({
      "teste.mscx": scoreXml("3.6.2", "3.01"),
      "META-INF/container.xml": containerXml(["teste.mscx"]),
    });

    expect(() => assertSupportedMscz(archive)).toThrow(
      /saved in MuseScore 3\.6\.2.*save it again/s,
    );
  });

  it("falls back to the format version when programVersion is missing", () => {
    const archive = makeArchive({
      "teste.mscx": '<museScore version="3.01"><Score/></museScore>',
      "META-INF/container.xml": containerXml(["teste.mscx"]),
    });

    expect(() => assertSupportedMscz(archive)).toThrow(/MuseScore 3/);
  });

  it("accepts an unversioned score rather than guessing", () => {
    const archive = makeArchive({ "teste.mscx": "<museScore><Score/></museScore>" });

    expect(() => assertSupportedMscz(archive)).not.toThrow();
  });

  it("reports a missing file distinctly from an unreadable one", () => {
    expect(() => assertSupportedMscz("/nonexistent/score.mscz")).toThrow(
      /File not found/,
    );

    const notAZip = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "mscz-archive-")),
      "broken.mscz",
    );
    temporaryDirectories.push(path.dirname(notAZip));
    fs.writeFileSync(notAZip, "definitely not a zip");

    expect(() => assertSupportedMscz(notAZip)).toThrow(/Could not open/);
  });
});

describe("readMsczVersion", () => {
  it("reads the version from the real reference score", () => {
    expect(readMsczVersion("test-scores/all-instruments.mscz")).toEqual({
      format: "4.70",
      program: "4.7.2",
    });
  });
});
