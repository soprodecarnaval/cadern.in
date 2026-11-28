import { describe, expect, it } from "vitest";
import type { PartViewModel, ScoreRevisionViewModel, ScoreViewModel } from "../../types/viewModels";
import type { Section } from "./pdfGeneration";
import {
  defaultPrintSettings,
  printableInstruments,
  printOptions,
  samePrintSettings,
} from "./songbookPrint";

const revision = (parts: PartViewModel["instrument"][]): ScoreRevisionViewModel => ({
  id: "r", revisionNumber: 1, uploadedBy: "u", uploadedAt: null as never,
  mscz: "", metajson: "", midi: "", notes: "",
  parts: parts.map((instrument) => ({ name: instrument, instrument, svg: [], midi: "" })),
});
const score = (id: string): ScoreViewModel => ({
  id, title: id, composer: "", sub: "", tags: [], projectId: "p", projectTitle: "P",
  latestRevision: revision([]),
});
const section = (...parts: PartViewModel["instrument"][][]): Section[] => [{
  title: "",
  scores: parts.map((p, index) => ({ score: score(String(index)), revision: revision(p), index })),
}];

const print = { fallbacks: ["tuba" as const], backSheetPageNumber: true, antiAssedioPages: false };

describe("printOptions", () => {
  it("defaults an older revision without settings", () => {
    expect(printOptions({})).toEqual({
      fallbackInstruments: new Set(),
      backSheetPageNumber: false,
      antiAssedioPages: false,
    });
  });

  it("uses the saved settings", () => {
    expect(printOptions({ print })).toEqual({
      fallbackInstruments: new Set(["tuba"]),
      backSheetPageNumber: true,
      antiAssedioPages: false,
    });
  });
});

describe("printableInstruments", () => {
  it("lists instruments with parts", () => {
    expect(printableInstruments(section(["trombone", "trompete"]), {}))
      .toEqual([{ instrument: "trompete" }, { instrument: "trombone" }]);
  });

  it("adds an instrument through its enabled fallback, saying which", () => {
    expect(printableInstruments(section(["trombone"]), { print }))
      .toEqual([{ instrument: "trombone" }, { instrument: "tuba", via: "trombone" }]);
  });

  it("leaves out a fallback that isn't enabled or has no parts", () => {
    expect(printableInstruments(section(["trompete"]), { print }))
      .toEqual([{ instrument: "trompete" }]);
  });

  it("ignores deleted scores", () => {
    const sections = section(["trombone"]);
    sections[0].scores[0].deleted = true;
    expect(printableInstruments(sections, {})).toEqual([]);
  });
});

describe("samePrintSettings", () => {
  it("ignores fallback order and sees any change", () => {
    const a = { ...defaultPrintSettings, fallbacks: ["tuba" as const, "bombardino" as const] };
    expect(samePrintSettings(a, { ...a, fallbacks: ["bombardino", "tuba"] })).toBe(true);
    expect(samePrintSettings(a, { ...a, fallbacks: ["tuba"] })).toBe(false);
    expect(samePrintSettings(a, { ...a, antiAssedioPages: true })).toBe(false);
  });
});
