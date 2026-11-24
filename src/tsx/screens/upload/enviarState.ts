// State of the send screen that does not need the engine: part rows, the
// pirata instrument rule, and the choices handed to renderForUpload.
import type { FormattingProfile, PartFormatting } from "../../../../types/formattingProfile";
import type { Instrument } from "../../../../types/instrument";
import type { Part } from "../../../lib/browserScore/types";
import { guessInstrument, mapInstrumentId, pirataInstrument } from "../../../lib/instruments";
import { partInstrumentSettings } from "../../../lib/scoreRender/partTransform";
import type { SheetLayoutResult, Warning } from "../../../lib/browserScore/types";
import type { RenderProgress } from "../../../lib/scoreRender/renderForUpload";
import type { PartChoice } from "../../../lib/scoreRender/renderForUpload";
import type { ScoreIdentity } from "../../../../types/metajson";
import type { ScoreMetadata } from "../../../../types/docs";
import { safeFilename } from "../../../lib/partFiles";
import { DEFAULT_FORMATTING_PROFILE } from "../../../../types/formattingProfile";
import type { RepinOutcome, UploadChecks } from "../../../lib/uploadFlow";
import type { UploadProgress } from "../../../lib/uploadScore";
import type { UploadTarget } from "../../../lib/uploadTarget";

export type Step = "arquivo" | "partes" | "dados" | "formatacao" | "enviar" | "feito";
export const STEPS: readonly { step: Exclude<Step, "feito">; label: string }[] = [
  { step: "arquivo", label: "Arquivo" },
  { step: "partes", label: "Partes" },
  { step: "dados", label: "Dados" },
  { step: "formatacao", label: "Formatação" },
  { step: "enviar", label: "Enviar" },
];

export type PartRow = {
  ordinal: number;
  name: string;
  /** The instrument as MuseScore names it, for the user to recognize. */
  museScoreInstrument: string;
  /** The cadern.in instrument; null when none could be found (the part is then skipped). */
  instrument: Instrument | null;
  /** True when the instrument came from a name guess, not the MuseScore id. */
  guessed: boolean;
  /** The instrument has fingering tables (trumpet, trombone, tuba, bombardino). */
  fingeringsAvailable: boolean;
  fingerings: boolean;
  family: "trumpet" | "trombone" | "tuba" | "euphonium" | null;
  include: boolean;
};

/** A row per part, with the instrument mapped from the MuseScore id (or the sound id), else guessed from the names. */
export function partRows(parts: readonly Pick<Part, "ordinal" | "name" | "instruments">[]): PartRow[] {
  return parts.map((part) => {
    const first = part.instruments[0];
    const names = [part.name, first?.longName, first?.shortName];
    const byId = first ? (mapInstrumentId(first.id, names) ?? (first.soundId ? mapInstrumentId(first.soundId, names) : null)) : null;
    const guess = byId ? null : guessInstrument(names);
    const { settings } = partInstrumentSettings(part);
    const fingeringsAvailable = !!settings?.fingering;
    const base = byId ?? guess;
    return {
      ordinal: part.ordinal,
      name: part.name,
      museScoreInstrument: first ? [first.longName, first.id || first.soundId].filter(Boolean).join(" · ") : "—",
      instrument: base ? pirataInstrument(base, fingeringsAvailable) : null,
      guessed: !byId && !!guess,
      fingeringsAvailable,
      fingerings: fingeringsAvailable,
      family: settings?.fingering?.family ?? null,
      include: !!base,
    };
  });
}

/** Turning fingerings on or off files a trumpet or trombone part as a pirata, or back (008). */
export function withFingerings(row: PartRow, fingerings: boolean): PartRow {
  const on = fingerings && row.fingeringsAvailable;
  return { ...row, fingerings: on, instrument: row.instrument ? pirataInstrument(row.instrument, on) : null };
}

/** A new instrument keeps the pirata rule: a fingered part is filed as a pirata when its instrument has one. */
export function withInstrument(row: PartRow, instrument: Instrument | null): PartRow {
  return {
    ...row,
    instrument: instrument ? pirataInstrument(instrument, row.fingerings) : null,
    include: instrument ? row.include || row.instrument === null : false,
    guessed: false,
  };
}

/** The parts to send, as renderForUpload takes them. */
export const choicesFrom = (rows: readonly PartRow[]): PartChoice[] =>
  rows
    .filter((row): row is PartRow & { instrument: Instrument } => row.include && row.instrument !== null)
    .map((row) => ({ ordinal: row.ordinal, instrument: row.instrument, name: row.name, fingerings: row.fingerings }));

/** The settings the formatting controls show: the score's, or one part's override over them. */
export function formattingOf(profile: FormattingProfile, partName: string | null): PartFormatting {
  const score: PartFormatting = {
    staffSize: profile.staffSize,
    systemsPerPage: profile.systemsPerPage,
    spacing: profile.spacing,
    fingering: profile.fingering,
    cleanup: profile.cleanup,
  };
  if (partName === null) {return score;}
  const part = profile.parts?.[partName] ?? {};
  return {
    staffSize: part.staffSize ?? score.staffSize,
    systemsPerPage: part.systemsPerPage ?? score.systemsPerPage,
    spacing: { ...score.spacing, ...part.spacing },
    fingering: { ...score.fingering, ...part.fingering },
    cleanup: { ...score.cleanup, ...part.cleanup },
  };
}

/** The profile with a change to the score's settings, or to one part's override. */
export function withFormatting(profile: FormattingProfile, partName: string | null, change: PartFormatting): FormattingProfile {
  const merge = (base: PartFormatting): PartFormatting => ({
    ...base,
    ...change,
    ...(change.fingering ? { fingering: { ...base.fingering, ...change.fingering } } : {}),
    ...(change.cleanup ? { cleanup: { ...base.cleanup, ...change.cleanup } } : {}),
    ...(change.spacing ? { spacing: { ...base.spacing, ...change.spacing } } : {}),
  });
  if (partName === null) {return { ...profile, ...merge(profile) } as FormattingProfile;}
  return { ...profile, parts: { ...profile.parts, [partName]: merge(profile.parts?.[partName] ?? {}) } };
}

/** The profile with the same change made to each of the named parts. */
export function withFormattingForAll(profile: FormattingProfile, partNames: readonly string[], change: PartFormatting): FormattingProfile {
  return partNames.reduce((current, name) => withFormatting(current, name, change), profile);
}

/** Whether a part has settings of its own. */
export const hasOverride = (profile: FormattingProfile, partName: string) =>
  Object.keys(profile.parts?.[partName] ?? {}).length > 0;

/** The profile without a part's own settings (back to the score's). */
export function withoutOverride(profile: FormattingProfile, partName: string): FormattingProfile {
  const { [partName]: _removed, ...rest } = profile.parts ?? {};
  return { ...profile, parts: rest };
}

// Engine warnings worth showing, in pt-BR. Informational ones (fidelity notes) are left out.
const WARNINGS: Record<string, string> = {
  SHEET_OVERFLOW: "Não coube em uma página: a parte continua em outra folha.",
  SHEET_STAFF_REDUCED: "A pauta ficou bem pequena para caber em uma página.",
  FINGERINGS_REDUCED: "Os números dos piratas foram diminuídos para caber em uma página.",
  FINGERING_OUT_OF_RANGE: "Algumas notas estão fora da tabela de piratas do instrumento e ficaram sem número.",
  TUBA_NOTATION_SKIPPED: "A parte troca de instrumento, então a escrita de tuba ficou como está no arquivo.",
  SYSTEM_MARKINGS_COPIED: "Andamento, ensaios e saltos foram copiados da primeira parte da partitura.",
  MIDI_FROM_FULL_SCORE: "O áudio desta parte vem da partitura completa.",
};

export const warningText = (warning: { code: string }): string | null => WARNINGS[warning.code] ?? null;

/** The engine's input limit (browser-score defaultLimits.inputBytes). */
export const MAX_SCORE_BYTES = 32 * 1024 * 1024;

export type Preview = {
  ordinal: number;
  svg: string | null;
  pages: number;
  layout: SheetLayoutResult | null;
  automaticFingeringSize?: number;
  warnings: readonly Warning[];
  rendering: boolean;
  error?: string;
};

export type Status =
  | { kind: "idle" }
  | { kind: "loading-engine" }
  | { kind: "opening" }
  | { kind: "preparing" }
  | { kind: "rendering"; progress?: RenderProgress }
  | { kind: "uploading"; progress?: UploadProgress }
  | { kind: "error"; message: string };

export type EnviarState = {
  step: Step;
  status: Status;
  fileName: string | null;
  /** What is stored as the score's uploaded metadata; starts from the file's tags. */
  metadata: ScoreMetadata;
  rows: PartRow[];
  profile: FormattingProfile;
  /** The part whose settings the formatting controls edit; null for the whole score. */
  editing: number | null;
  previews: Record<number, Preview>;
  /** Object URLs of part MIDI files, made when the user asks to listen. */
  midi: Record<number, string>;
  target: UploadTarget | null;
  checks: UploadChecks | null;
  result: { identity: ScoreIdentity; target: UploadTarget; repin: RepinOutcome } | null;
};

export const initialState = (): EnviarState => ({
  step: "arquivo",
  status: { kind: "idle" },
  fileName: null,
  metadata: { title: "", composer: "", sub: "", tags: [] },
  rows: [],
  profile: DEFAULT_FORMATTING_PROFILE,
  editing: null,
  previews: {},
  midi: {},
  target: null,
  checks: null,
  result: null,
});

/** A part as a stored revision lists it (its .metajson). */
export type StoredPart = { name: string; instrument: Instrument };

/**
 * The rows of a reformat: only the parts the revision had, at their stored
 * instruments, with fingerings as the stored profile set them (a pirata
 * instrument means fingerings on).
 */
export function rowsFromStored(rows: readonly PartRow[], stored: readonly StoredPart[], profile: FormattingProfile): PartRow[] {
  if (!stored.length) {return [...rows];}
  return rows.map((row) => {
    const part = stored.find((candidate) => candidate.name === row.name);
    if (!part) {return { ...row, include: false };}
    const enabled = profile.parts?.[row.name]?.fingering?.enabled ?? profile.fingering?.enabled;
    // Trumpet and trombone say it in the instrument; tuba and bombardino only in the profile.
    const piratas = part.instrument === "trompete" || part.instrument === "trombone" || part.instrument.endsWith(" pirata");
    const fingerings = row.fingeringsAvailable && (piratas ? part.instrument.endsWith(" pirata") : (enabled ?? row.fingerings));
    return { ...row, instrument: pirataInstrument(part.instrument, fingerings), fingerings, include: true, guessed: false };
  });
}

/**
 * The metadata a MuseScore file carries, as the plugin reads it: work title (or
 * the file name), composer, source as the excerpt ("Trecho"), and the lyricist
 * field as comma-separated tags.
 */
export function metadataFromTags(tags: Readonly<Record<string, string>>, fileName: string): ScoreMetadata {
  return {
    title: safeFilename(tags.workTitle?.trim() || fileName.replace(/\.(mscz|mscx)$/i, "")),
    composer: tags.composer?.trim() ?? "",
    sub: tags.source?.trim() ?? "",
    tags: tagsFromText(tags.lyricist ?? ""),
  };
}

export const tagsFromText = (text: string): string[] => text.split(",").map((tag) => tag.trim()).filter(Boolean);

/** Why the metadata cannot be sent yet, or null. */
export function metadataProblem(metadata: ScoreMetadata): string | null {
  return metadata.title.trim() ? null : "Dê um título à partitura.";
}
