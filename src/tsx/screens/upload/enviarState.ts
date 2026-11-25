// State of the send screen that does not need the engine: part rows, the
// pirata instrument rule, and the choices handed to renderForUpload.
import type { FormattingProfile, PartFormatting } from "../../../../types/formattingProfile";
import type { Instrument } from "../../../../types/instrument";
import type { Part, PlaybackFrame } from "../../../lib/browserScore/types";
import { chosenFamily, guessInstrument, mapInstrumentId, pirataInstrument, sameInstrumentFamily } from "../../../lib/instruments";
import type { SheetLayoutResult, Warning } from "../../../lib/browserScore/types";
import type { RenderProgress } from "../../../lib/scoreRender/renderForUpload";
import type { PartChoice } from "../../../lib/scoreRender/renderForUpload";
import type { ScoreIdentity } from "../../../../types/metajson";
import type { ScoreMetadata } from "../../../../types/docs";
import { safeFilename } from "../../../lib/partFiles";
import { partKey, partOverride, type PartRef } from "../../../lib/scoreRender/profile";
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
  /**
   * The instrument the MuseScore id gives, when the part's own name names another one and the
   * name won (024): arrangers often reuse a staff (e.g. a tenor sax part on a trumpet staff).
   */
  idInstrument?: Instrument;
  /** The chosen instrument has fingering tables (trumpet, trombone, tuba, bombardino), whatever the file declares. */
  fingeringsAvailable: boolean;
  fingerings: boolean;
  family: "trumpet" | "trombone" | "tuba" | "euphonium" | null;
  include: boolean;
};

/**
 * A row per part, with the instrument mapped from the MuseScore id (or the sound id), else guessed
 * from the names. When the part's own name names an instrument of another family than the id's,
 * the name wins (024): the file reuses another instrument's staff.
 */
export function partRows(parts: readonly Pick<Part, "ordinal" | "name" | "instruments">[]): PartRow[] {
  return parts.map((part) => {
    const first = part.instruments[0];
    const names = [part.name, first?.longName, first?.shortName];
    const byId = first ? (mapInstrumentId(first.id, names) ?? (first.soundId ? mapInstrumentId(first.soundId, names) : null)) : null;
    // Only the part's own name: the instrument names are the reused staff's.
    const byName = guessInstrument([part.name]);
    const overridden = !!byId && !!byName && !sameInstrumentFamily(byId, byName);
    const guess = byId ? null : guessInstrument(names);
    const base = overridden ? byName : (byId ?? guess);
    const family = base ? chosenFamily(base) : null;
    const fingeringsAvailable = !!family;
    return {
      ordinal: part.ordinal,
      name: part.name,
      museScoreInstrument: first ? [first.longName, first.id || first.soundId].filter(Boolean).join(" · ") : "—",
      instrument: base ? pirataInstrument(base, fingeringsAvailable) : null,
      guessed: !byId && !!guess,
      ...(overridden ? { idInstrument: byId } : {}),
      fingeringsAvailable,
      fingerings: fingeringsAvailable,
      family,
      include: !!base,
    };
  });
}

/** Turning fingerings on or off files a trumpet or trombone part as a pirata, or back (008). */
export function withFingerings(row: PartRow, fingerings: boolean): PartRow {
  const on = fingerings && row.fingeringsAvailable;
  return { ...row, fingerings: on, instrument: row.instrument ? pirataInstrument(row.instrument, on) : null };
}

/**
 * A new instrument makes the part that instrument: piratas become available (on) or go away with it,
 * and a fingered part is filed as a pirata when its instrument has one.
 */
export function withInstrument(row: PartRow, instrument: Instrument | null): PartRow {
  const family = instrument ? chosenFamily(instrument) : null;
  const fingeringsAvailable = !!family;
  const fingerings = fingeringsAvailable && (row.fingeringsAvailable ? row.fingerings : true);
  return {
    ...row,
    family,
    fingeringsAvailable,
    fingerings,
    instrument: instrument ? pirataInstrument(instrument, fingerings) : null,
    include: instrument ? row.include || row.instrument === null : false,
    guessed: false,
    idInstrument: undefined,
  };
}

/** The parts to send, as renderForUpload takes them. */
export const choicesFrom = (rows: readonly PartRow[]): PartChoice[] =>
  rows
    .filter((row): row is PartRow & { instrument: Instrument } => row.include && row.instrument !== null)
    .map((row) => ({ ordinal: row.ordinal, instrument: row.instrument, name: row.name, fingerings: row.fingerings }));

/** The settings the formatting controls show: the score's, or one part's override over them. */
export function formattingOf(profile: FormattingProfile, part: PartRef | null): PartFormatting {
  const score: PartFormatting = {
    staffSize: profile.staffSize,
    systemsPerPage: profile.systemsPerPage,
    spacing: profile.spacing,
    fingering: profile.fingering,
    cleanup: profile.cleanup,
  };
  if (part === null) {return score;}
  const own = partOverride(profile, part);
  return {
    staffSize: own.staffSize ?? score.staffSize,
    systemsPerPage: own.systemsPerPage ?? score.systemsPerPage,
    spacing: { ...score.spacing, ...own.spacing },
    fingering: { ...score.fingering, ...own.fingering },
    cleanup: { ...score.cleanup, ...own.cleanup },
  };
}

/** The profile without the part's own settings, under either key. */
const withoutPart = (profile: FormattingProfile, part: PartRef) => {
  const { [partKey(part)]: _byOrdinal, [part.name]: _byName, ...rest } = profile.parts ?? {};
  return rest;
};

/** The profile with a change to the score's settings, or to one part's override (keyed by ordinal, 023). */
export function withFormatting(profile: FormattingProfile, part: PartRef | null, change: PartFormatting): FormattingProfile {
  const merge = (base: PartFormatting): PartFormatting => ({
    ...base,
    ...change,
    ...(change.fingering ? { fingering: { ...base.fingering, ...change.fingering } } : {}),
    ...(change.cleanup ? { cleanup: { ...base.cleanup, ...change.cleanup } } : {}),
    ...(change.spacing ? { spacing: { ...base.spacing, ...change.spacing } } : {}),
  });
  if (part === null) {return { ...profile, ...merge(profile) } as FormattingProfile;}
  return { ...profile, parts: { ...withoutPart(profile, part), [partKey(part)]: merge(partOverride(profile, part)) } };
}

/** The profile with the same change made to each of the given parts. */
export function withFormattingForAll(profile: FormattingProfile, parts: readonly PartRef[], change: PartFormatting): FormattingProfile {
  return parts.reduce((current, part) => withFormatting(current, part, change), profile);
}

/** Whether a part has settings of its own. */
export const hasOverride = (profile: FormattingProfile, part: PartRef) =>
  Object.keys(partOverride(profile, part)).length > 0;

/** The profile without a part's own settings (back to the score's). */
export function withoutOverride(profile: FormattingProfile, part: PartRef): FormattingProfile {
  return { ...profile, parts: withoutPart(profile, part) };
}

// Engine warnings worth showing, in pt-BR. Informational ones (fidelity notes) are left out.
const WARNINGS: Record<string, string> = {
  MANUAL_OFFSETS_UNMATCHED: "Algumas correções manuais não puderam ser aplicadas nesta prévia.",
  SHEET_OVERFLOW: "Não coube em uma página: a parte continua em outra folha.",
  SHEET_STAFF_REDUCED: "A pauta ficou bem pequena para caber em uma página.",
  FINGERINGS_REDUCED: "Os números dos piratas foram diminuídos para caber em uma página.",
  FINGERING_OUT_OF_RANGE: "Algumas notas estão fora da tabela de piratas do instrumento e ficaram sem número.",
  TUBA_NOTATION_SKIPPED: "A parte troca de instrumento, então a escrita de tuba ficou como está no arquivo.",
  MIDI_FROM_FULL_SCORE: "O áudio desta parte vem da partitura completa.",
};

export const warningText = (warning: { code: string }): string | null => WARNINGS[warning.code] ?? null;

/** The engine's input limit (browser-score defaultLimits.inputBytes). */
export const MAX_SCORE_BYTES = 32 * 1024 * 1024;

export type Preview = {
  ordinal: number;
  svg: string | null;
  pageSvg?: string;
  fontCss?: string;
  signature?: string;
  pages: number;
  layout: SheetLayoutResult | null;
  automaticFingeringSize?: number;
  warnings: readonly Warning[];
  rendering: boolean;
  error?: string;
};

export type ArrangementPreview = { svg: string; staffSpaceMm: number };

export type PreviewAudio = { url: string; pageSvg: string; frames: readonly PlaybackFrame[] };

export type CollisionDraft = { original: string; signature: string; history: readonly string[] };

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
  collisions: Record<number, CollisionDraft>;
  /** Preview audio tied to the exact rendered page. */
  midi: Record<number, PreviewAudio>;
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
  collisions: {},
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
    const enabled = partOverride(profile, row).fingering?.enabled ?? profile.fingering?.enabled;
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
