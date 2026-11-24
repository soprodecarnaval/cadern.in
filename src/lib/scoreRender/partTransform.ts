// The caderninho transform of one part's MusicXML, run by the browser-score
// library before drawing: clean-up (007), tuba notation (009), fingerings
// (008), as the FormattingProfile asks.
import type { FormattingProfile } from "../../../types/formattingProfile";
import type { Part, PartTransform, Warning } from "../browserScore/types";
import { chosenInstrumentSettings, fingeringFunction, instrumentSettings, type InstrumentSettings } from "../instruments";
import type { Instrument } from "../../../types/instrument";
import { cleanupMusicXml, type CleanupReport } from "./cleanup";
import { fingerPart, type FingeringReport } from "./fingering";
import { applyTubaNotation, type TubaNotationReport } from "./tubaNotation";
import { narrowRestMeasures, type RestMeasuresReport } from "./restMeasures";
import { resolvePartFormatting, type ResolvedPartFormatting } from "./profile";

export type XmlCodec = { parse: (text: string) => Document; serialize: (document: Document) => string };

const browserCodec: XmlCodec = {
  parse: (text) => new DOMParser().parseFromString(text, "application/xml"),
  serialize: (document) => new XMLSerializer().serializeToString(document),
};

export type PartTransformReport = {
  partName: string;
  /** MuseScore instrument id the settings came from, when any. */
  instrumentId: string | null;
  cleanup: CleanupReport;
  /** Tuba notation applied, per MusicXML part; empty when none applies. */
  tubaNotation: TubaNotationReport[];
  /** Set when the part is a tuba but has instrument changes, which the plugin also skips. */
  tubaNotationSkipped?: "instrument-changes";
  /** Whole-measure rests drawn narrow (one beat wide), per MusicXML part. */
  restMeasures: RestMeasuresReport[];
  /** Empty when the part gets no fingerings. */
  fingerings: FingeringReport[];
};

/** The instrument settings of a library part: its first instrument, by MuseScore id, else sound id. */
export function partInstrumentSettings(part: Pick<Part, "instruments" | "name">): {
  instrumentId: string | null;
  settings: InstrumentSettings | null;
} {
  const instrument = part.instruments[0];
  if (!instrument) {return { instrumentId: null, settings: null };}
  const names = [part.name, instrument.longName, instrument.shortName];
  for (const id of [instrument.id, instrument.soundId]) {
    const settings = id ? instrumentSettings(id, names) : null;
    if (settings) {return { instrumentId: id, settings };}
  }
  return { instrumentId: instrument.id || instrument.soundId, settings: null };
}

/**
 * The settings a part is formatted with: the instrument the user filed it under when there is one,
 * else the one the file declares.
 */
export function partSettings(part: Pick<Part, "instruments" | "name">, chosen?: Instrument | null): {
  instrumentId: string | null;
  settings: InstrumentSettings | null;
} {
  const source = partInstrumentSettings(part);
  return chosen ? { instrumentId: source.instrumentId, settings: chosenInstrumentSettings(chosen, source.settings) } : source;
}

/** Whether a resolved part gets fingerings: by its own setting, else by instrument. */
export const fingeringsOn = (
  formatting: ResolvedPartFormatting,
  settings: InstrumentSettings | null,
): boolean =>
  !!settings?.fingering &&
  (formatting.fingering.enabled === "byInstrument" ? true : formatting.fingering.enabled);

/** Transform one part's MusicXML text. */
export function transformPartMusicXml(
  musicXml: string,
  part: Pick<Part, "instruments" | "name">,
  profile: FormattingProfile,
  codec: XmlCodec = browserCodec,
  /** The instrument the part is filed under; its settings win over the file's. */
  chosen?: Instrument | null,
): { musicXml: string; report: PartTransformReport } {
  const formatting = resolvePartFormatting(profile, part.name);
  const document = codec.parse(musicXml);
  const cleanup = cleanupMusicXml(document, formatting.cleanup);
  const { instrumentId, settings } = partSettings(part, chosen);
  const parts = Array.from(document.documentElement.childNodes).filter(
    (node): node is Element => node.nodeType === 1 && (node as Element).localName === "part",
  );
  // Tuba notation first, so fingering placement sees the final clef.
  const tubaNotation: TubaNotationReport[] = [];
  let tubaNotationSkipped: PartTransformReport["tubaNotationSkipped"];
  if (settings?.tubaPolicy) {
    if (part.instruments.length > 1) {
      tubaNotationSkipped = "instrument-changes";
    } else {
      for (const element of parts) {
        const report = applyTubaNotation(element, settings.tubaPolicy);
        if (report) {tubaNotation.push(report);}
      }
    }
  }
  const fingerings: FingeringReport[] = [];
  if (fingeringsOn(formatting, settings)) {
    for (const element of parts) {
      const fingeringFor = fingeringFunction(settings, formatting.fingering);
      if (fingeringFor) {fingerings.push(fingerPart(element, fingeringFor));}
    }
  }
  // Rests last: whole-measure rests keep their bars but take one beat's width.
  const restMeasures = parts.map(narrowRestMeasures);
  return {
    musicXml: codec.serialize(document),
    report: {
      restMeasures,
      partName: part.name,
      instrumentId,
      cleanup,
      tubaNotation,
      ...(tubaNotationSkipped ? { tubaNotationSkipped } : {}),
      fingerings,
    },
  };
}

/** A library PartTransform for a profile; `onReport` receives each part's report. */
export function caderninhoPartTransform(
  profile: FormattingProfile,
  onReport?: (report: PartTransformReport) => void,
  /** The instrument each part is filed under (by ordinal), when the user chose one. */
  instrumentOf?: (part: Part) => Instrument | null | undefined,
): PartTransform {
  return ({ musicXml, part }) => {
    const result = transformPartMusicXml(musicXml, part, profile, browserCodec, instrumentOf?.(part));
    onReport?.(result.report);
    const warnings: Warning[] = [];
    if (result.report.tubaNotationSkipped) {
      warnings.push({
        code: "TUBA_NOTATION_SKIPPED",
        message: "The part changes instrument, so its tuba notation was left as written.",
      });
    }
    warnings.push(...result.report.fingerings
      .filter((report) => report.unfingered > 0)
      .map((report) => ({
        code: "FINGERING_OUT_OF_RANGE",
        message: `${report.unfingered} notes are outside the instrument's fingering table and have no fingering.`,
      })));
    return { musicXml: result.musicXml, warnings };
  };
}
