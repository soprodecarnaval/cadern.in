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
export const DEFAULT_SPACING = { linear: 0.21, nonLinear: 0.6, system: 4 } as const;

export type ResolvedPartFormatting = {
  staffSize: "auto" | number;
  systemsPerPage: "auto" | number;
  spacing: { linear: number; nonLinear: number; system: number };
  fingering: Required<Omit<NonNullable<PartFormatting["fingering"]>, "enabled">> & {
    enabled: boolean | "byInstrument";
  };
  cleanup: CleanupOptions;
};

/** The profile with the part's overrides applied over the score's settings and the defaults. */
export function resolvePartFormatting(
  profile: FormattingProfile,
  partName: string,
): ResolvedPartFormatting {
  const part = profile.parts?.[partName] ?? {};
  return {
    staffSize: part.staffSize ?? profile.staffSize ?? "auto",
    systemsPerPage: part.systemsPerPage ?? profile.systemsPerPage ?? "auto",
    spacing: { ...DEFAULT_SPACING, ...profile.spacing, ...part.spacing },
    fingering: {
      enabled: "byInstrument",
      notation: "positions",
      valveCount: 3,
      dynamicTrombone: false,
      size: "auto",
      ...profile.fingering,
      ...part.fingering,
    },
    cleanup: { ...DEFAULT_CLEANUP, ...profile.cleanup, ...part.cleanup },
  };
}

/** Library options for a profile: fitted pages in the profile's box. */
export function libraryOptionsFor(
  profile: FormattingProfile,
): Pick<LibraryOptions, "partPageStyle" | "fitArea"> {
  return {
    partPageStyle: "fitted",
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
    ...(part.fingering.size === "auto" ? {} : { fingeringScale: part.fingering.size }),
  };
}
