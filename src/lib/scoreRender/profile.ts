// A FormattingProfile resolved for one part, and mapped onto browser-score
// library options.
import {
  SONGBOOK_FIT_AREA,
  type FormattingProfile,
  type PartFormatting,
} from "../../../types/formattingProfile";
import type { LibraryOptions, SheetLayout } from "../browserScore/types";
import { DEFAULT_CLEANUP, type CleanupOptions } from "./cleanup";

/** Verovio spacing the library uses when the profile sets none. */
export const DEFAULT_SPACING = { linear: 0.21, nonLinear: 0.6, system: 4, evenNoteSpacing: true } as const;

export type ResolvedPartFormatting = {
  staffSize: "auto" | number;
  systemsPerPage: "auto" | number;
  spacing: { linear: number; nonLinear: number; system: number; evenNoteSpacing: boolean };
  fingering: Required<Omit<NonNullable<PartFormatting["fingering"]>, "enabled">> & {
    enabled: boolean | "byInstrument";
  };
  cleanup: CleanupOptions;
};

/** A part of the score, as per-part settings identify it. */
export type PartRef = { ordinal: number; name: string };

/**
 * The key of a part's own settings in `profile.parts`: its ordinal, so parts with the same name
 * (two "Trompete" parts) keep their own settings (023). Revisions stored before used the part
 * name, which `partOverride` still reads.
 */
export const partKey = (part: Pick<PartRef, "ordinal">) => `#${part.ordinal}`;

/** A part's own settings: by ordinal, else by name (revisions stored before 023). */
export function partOverride(profile: FormattingProfile, part: PartRef): PartFormatting {
  return profile.parts?.[partKey(part)] ?? profile.parts?.[part.name] ?? {};
}

/** The profile with name-keyed part settings moved to the ordinal of every part with that name. */
export function keyedByOrdinal(profile: FormattingProfile, parts: readonly PartRef[]): FormattingProfile {
  if (!profile.parts) {return profile;}
  const named = new Set(parts.map((part) => part.name));
  const keyed = Object.fromEntries(Object.entries(profile.parts).filter(([key]) => !named.has(key) || key.startsWith("#")));
  for (const part of parts) {
    const own = profile.parts[partKey(part)] ?? profile.parts[part.name];
    if (own) {keyed[partKey(part)] = own;}
  }
  return { ...profile, parts: keyed };
}

/** The profile with the part's overrides applied over the score's settings and the defaults. */
export function resolvePartFormatting(
  profile: FormattingProfile,
  partRef: PartRef,
): ResolvedPartFormatting {
  const part = partOverride(profile, partRef);
  const usesFileFingerings = (part.fingering?.notation ?? profile.fingering?.notation) === "file";
  return {
    staffSize: part.staffSize ?? profile.staffSize ?? "auto",
    systemsPerPage: part.systemsPerPage ?? profile.systemsPerPage ?? "auto",
    spacing: { ...DEFAULT_SPACING, ...profile.spacing, ...part.spacing },
    fingering: {
      enabled: "byInstrument",
      notation: "positions",
      dynamicTrombone: false,
      size: "auto",
      ...profile.fingering,
      ...part.fingering,
    },
    // The file's fingerings stay when the part uses them as its piratas.
    cleanup: { ...DEFAULT_CLEANUP, ...profile.cleanup, ...part.cleanup, ...(usesFileFingerings ? { fingerings: false } : {}) },
  };
}

/** Library options for a profile: fitted pages in the profile's box. */
export function libraryOptionsFor(
  profile: FormattingProfile,
): Pick<LibraryOptions, "partPageStyle" | "fitArea" | "textFonts"> {
  return {
    partPageStyle: "fitted",
    // Stored pages name their text fonts; the reader and the songbook PDF load the shared files (014).
    textFonts: "shared",
    fitArea: { ...(profile.fitArea ?? SONGBOOK_FIT_AREA) },
  };
}

/** The sheet layout the library is asked for, for one resolved part. */
export function sheetLayoutFor(part: ResolvedPartFormatting): SheetLayout {
  return {
    ...(part.staffSize === "auto" ? {} : { staffSpaceMm: part.staffSize }),
    ...(part.systemsPerPage === "auto" ? {} : { systems: part.systemsPerPage }),
    spacingLinear: part.spacing.linear,
    spacingNonLinear: part.spacing.nonLinear,
    spacingSystem: part.spacing.system,
    evenNoteSpacing: part.spacing.evenNoteSpacing,
    ...(part.fingering.size === "auto" ? {} : { fingeringScale: part.fingering.size }),
  };
}
