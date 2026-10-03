import { describe, expect, it } from "vitest";
import { parseUploadedFiles } from "./parseUploadedFiles";
import { METAJSON_VERSION } from "../../types/metajson";

const file = (name: string, contents = "x") => new File([contents], name);

const TITLE = "Marcha";

const v2Metajson = (parts: unknown[]) =>
  file(
    `${TITLE}.metajson`,
    JSON.stringify({
      version: METAJSON_VERSION,
      composer: "Zé",
      previousSource: "Trecho 2",
      poet: "marcha, junina",
      parts,
    }),
  );

describe("parseUploadedFiles — metajson v2", () => {
  it("keeps an arbitrary part name out of the storage keys", async () => {
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file(`${TITLE}.midi`),
      file(`${TITLE}-trompete-a-1.svg`),
      file(`${TITLE}-trompete-a.midi`),
      v2Metajson([
        {
          name: "All your base are belong to us 💸🤠 11/22",
          instrument: "trompete",
          svg: [`${TITLE}-trompete-a-1.svg`],
          midi: `${TITLE}-trompete-a.midi`,
        },
      ]),
    ]);

    expect(parsed.parts).toHaveLength(1);
    const part = parsed.parts[0];
    expect(part.name).toBe("All your base are belong to us 💸🤠 11/22");
    expect(part.basename).toBe(`${TITLE}-trompete-a`);
    // The authored name must never reach a path.
    expect(part.midi).toBe(`parts/${TITLE}-trompete-a.midi`);
    expect(part.svg).toEqual([`parts/${TITLE}-trompete-a-1.svg`]);
    for (const key of parsed.fileMap.keys()) {
      expect(key.replace(/^parts\//, "")).not.toContain("/");
    }
  });

  it("takes the instrument from the manifest, not the filename", async () => {
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file("anonymous-1.svg"),
      file("anonymous.midi"),
      v2Metajson([
        {
          name: "Sax Bari",
          instrument: "sax baritono",
          svg: ["anonymous-1.svg"],
          midi: "anonymous.midi",
        },
      ]),
    ]);

    expect(parsed.parts[0].instrument).toBe("sax baritono");
    expect(parsed.warnings.map((w) => w.code)).not.toContain(
      "INSTRUMENT_NOT_DETECTED",
    );
  });

  it("orders pages by the manifest, not by filename", async () => {
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file("b.svg"),
      file("a.svg"),
      file("p.midi"),
      v2Metajson([
        {
          name: "Flauta",
          instrument: "flauta",
          svg: ["b.svg", "a.svg"],
          midi: "p.midi",
        },
      ]),
    ]);

    expect(parsed.parts[0].svg).toEqual(["parts/p-1.svg", "parts/p-2.svg"]);
    expect(parsed.fileMap.get("parts/p-1.svg")?.name).toBe("b.svg");
    expect(parsed.fileMap.get("parts/p-2.svg")?.name).toBe("a.svg");
  });

  it("identifies the full-score midi as the one no part claims", async () => {
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file(`${TITLE}.midi`),
      file("p-1.svg"),
      file("p.midi"),
      v2Metajson([
        { name: "Flauta", instrument: "flauta", svg: ["p-1.svg"], midi: "p.midi" },
      ]),
    ]);

    expect(parsed.fileMap.get("midi")?.name).toBe(`${TITLE}.midi`);
  });

  it("warns when the manifest references a file that was not uploaded", async () => {
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file("p.midi"),
      v2Metajson([
        {
          name: "Flauta",
          instrument: "flauta",
          svg: ["missing-1.svg"],
          midi: "p.midi",
        },
      ]),
    ]);

    expect(parsed.warnings).toContainEqual({
      code: "METAJSON_FILE_MISSING",
      meta: { file: "missing-1.svg" },
    });
  });

  it("does not mistake MuseScore's own metajson for a v2 manifest", async () => {
    // MuseScore writes a parts array of its own shape, and no version field.
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file(`${TITLE}-trompete-1.svg`),
      file(`${TITLE}-trompete.midi`),
      file(
        `${TITLE}.metajson`,
        JSON.stringify({
          composer: "Zé",
          previousSource: "",
          poet: "",
          parts: [{ name: "Trompete", instrumentId: "bb-trumpet" }],
        }),
      ),
    ]);

    expect(parsed.warnings.map((w) => w.code)).toContain("METAJSON_LEGACY");
    expect(parsed.parts).toEqual([]);
  });
});

describe("parseUploadedFiles — pre-v2", () => {
  it("refuses a folder with no manifest instead of guessing", async () => {
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file(`${TITLE}.midi`),
      file(`${TITLE}-trompete-1.svg`),
      file(`${TITLE}-trompete.midi`),
      file(
        `${TITLE}.metajson`,
        JSON.stringify({ composer: "Zé", previousSource: "", poet: "marcha" }),
      ),
    ]);

    // Filenames are no longer load-bearing: the parts are perfectly
    // inferrable, and are deliberately not inferred.
    expect(parsed.parts).toEqual([]);
    expect(parsed.warnings.map((w) => w.code)).toContain("METAJSON_LEGACY");
    // UploadPage blocks on parts.length === 0, so this reads as a refusal.
  });

  it("still reports the metadata it can read, for the warning to make sense", async () => {
    const parsed = await parseUploadedFiles([
      file(`${TITLE}.mscz`),
      file(
        `${TITLE}.metajson`,
        JSON.stringify({ composer: "Zé", previousSource: "", poet: "marcha" }),
      ),
    ]);

    expect(parsed.title).toBe(TITLE);
    expect(parsed.composer).toBe("Zé");
  });
});
