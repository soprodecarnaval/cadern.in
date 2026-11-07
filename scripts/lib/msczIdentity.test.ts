import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import {
  readMsczIdentity,
  stampMsczFile,
  stampMsczIdentity,
} from "./msczIdentity";

const IDENTITY = { scoreId: "acervo-eva", revisionId: "eva-20261031T120000-a1b2" };

const archive = (scoreXml: string): Buffer => {
  const zip = new AdmZip();
  zip.addFile("score.mscx", Buffer.from(scoreXml));
  zip.addFile(
    "Excerpts/Trompete/part.mscx",
    Buffer.from("<museScore><Score /></museScore>"),
  );
  return zip.toBuffer();
};

const SCORE =
  '<museScore><Score><metaTag name="workTitle">Eva</metaTag></Score></museScore>';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("mscz identity", () => {
  it("is null on a file that was never stamped", () => {
    expect(readMsczIdentity(archive(SCORE))).toBeNull();
  });

  it("round-trips, keeping other tags and leaving excerpts alone", () => {
    const stamped = stampMsczIdentity(archive(SCORE), IDENTITY);
    expect(readMsczIdentity(stamped)).toEqual(IDENTITY);
    const zip = new AdmZip(stamped);
    expect(zip.getEntry("score.mscx")?.getData().toString()).toContain(
      '<metaTag name="workTitle">Eva</metaTag>',
    );
    expect(
      zip.getEntry("Excerpts/Trompete/part.mscx")?.getData().toString(),
    ).toBe("<museScore><Score /></museScore>");
  });

  it("replaces an earlier identity instead of adding a second one", () => {
    const next = { scoreId: "garota-eva", revisionId: "eva-2" };
    const stamped = stampMsczIdentity(
      stampMsczIdentity(archive(SCORE), IDENTITY),
      next,
    );
    expect(readMsczIdentity(stamped)).toEqual(next);
    const xml = new AdmZip(stamped).getEntry("score.mscx")?.getData().toString();
    expect(xml?.match(/cadernin-score-id/g)).toHaveLength(1);
  });

  it("stamps a file in place", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mscz-identity-"));
    temporaryDirectories.push(directory);
    const file = path.join(directory, "eva.mscz");
    fs.writeFileSync(file, archive(SCORE));
    stampMsczFile(file, IDENTITY);
    expect(readMsczIdentity(file)).toEqual(IDENTITY);
    expect(fs.readdirSync(directory)).toEqual(["eva.mscz"]);
  });
});
