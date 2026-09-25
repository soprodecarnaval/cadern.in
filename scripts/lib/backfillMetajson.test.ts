import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildMetajson } from "./backfillMetajson";
import { zMetajson } from "../../types/metajson";

const directories: string[] = [];

/** Writes a pre-v2 exported folder: filenames carry the instrument. */
const makeFolder = (files: Record<string, string>): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "backfill-"));
  directories.push(directory);
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), contents);
  }
  return directory;
};

const legacySidecar = JSON.stringify({
  composer: "Zé",
  previousSource: "Trecho 2",
  poet: "marcha, junina",
});

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("buildMetajson", () => {
  it("produces a valid v2 sidecar from an inferred folder", () => {
    const folder = makeFolder({
      "Marcha.mscz": "z",
      "Marcha.midi": "m",
      "Marcha.metajson": legacySidecar,
      "Marcha-trompete-1.svg": "s",
      "Marcha-trompete-2.svg": "s",
      "Marcha-trompete.midi": "m",
    });

    const { metajson } = buildMetajson(folder);

    expect(zMetajson.safeParse(metajson).success).toBe(true);
    expect(metajson.parts).toEqual([
      {
        // Title stripped, matching what the Firestore backfill writes.
        name: "trompete",
        instrument: "trompete",
        svg: ["Marcha-trompete-1.svg", "Marcha-trompete-2.svg"],
        midi: "Marcha-trompete.midi",
      },
    ]);
  });

  it("round-trips the metadata fields, including poet/tags", () => {
    const folder = makeFolder({
      "Marcha.mscz": "z",
      "Marcha.metajson": legacySidecar,
      "Marcha-flauta-1.svg": "s",
      "Marcha-flauta.midi": "m",
    });

    const { metajson } = buildMetajson(folder);

    expect(metajson.composer).toBe("Zé");
    expect(metajson.previousSource).toBe("Trecho 2");
    // parseUploadedFiles splits poet into tags; this is the inverse.
    expect(metajson.poet).toBe("marcha, junina");
  });

  it("keeps duplicate instruments distinct", () => {
    const folder = makeFolder({
      "Marcha.mscz": "z",
      "Marcha.metajson": legacySidecar,
      "Marcha-trompete-a-1.svg": "s",
      "Marcha-trompete-a.midi": "m",
      "Marcha-trompete-b-1.svg": "s",
      "Marcha-trompete-b.midi": "m",
    });

    const { metajson } = buildMetajson(folder);

    expect(metajson.parts.map((p) => p.name).sort()).toEqual([
      "trompete a",
      "trompete b",
    ]);
  });

  it("refuses a folder with no score in it", () => {
    const folder = makeFolder({ "notes.txt": "hello" });

    expect(() => buildMetajson(folder)).toThrow(/No \.mscz found/);
  });

  it("refuses a folder whose filenames yield no instruments", () => {
    const folder = makeFolder({ "Marcha.mscz": "z", "Marcha.metajson": legacySidecar });

    expect(() => buildMetajson(folder)).toThrow(/No parts found/);
  });

  it("reports what the inference could not work out", () => {
    const folder = makeFolder({
      "Marcha.mscz": "z",
      "Marcha.metajson": legacySidecar,
      "Marcha-flauta-1.svg": "s",
      "Marcha-flauta.midi": "m",
      "Marcha-kazoo-1.svg": "s",
    });

    const { warnings } = buildMetajson(folder);

    expect(warnings.join(" ")).toMatch(/kazoo/);
  });
});
