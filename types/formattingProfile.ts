import z from "zod";

// How a revision's parts are laid out in the browser (tickets 006–009). Stored
// with each revision, next to the renderer versions, so the same .mscz,
// profile and renderer always give the same SVGs. A field left out takes the
// default, so older profiles keep rendering as they did.

export const FORMATTING_PROFILE_VERSION = 1;

/** The box createSongBook places each part in, in millimetres. */
export const SONGBOOK_FIT_AREA = { widthMm: 171.7, heightMm: 98.2 } as const;

const zAuto = z.literal("auto");

export const zFingering = z.object({
  /** Whether the part gets fingerings (piratas). Default: by instrument (008). */
  enabled: z.boolean().optional(),
  /**
   * Positions 1–7 (default) or valves; valves work for any part, valve trombone included.
   * "file": the fingerings the arranger wrote in the file, kept as they are; none are generated.
   */
  notation: z.enum(["positions", "valves", "file"]).optional(),
  /** Trombone in positions mode: choose among alternative positions. */
  dynamicTrombone: z.boolean().optional(),
  /** Fingering text size: "auto" fits with the staff, or a Verovio fingering scale. */
  size: z.union([zAuto, z.number().min(0.3).max(2)]).optional(),
});

export const zCleanup = z.object({
  credits: z.boolean().optional(),
  fingerings: z.boolean().optional(),
  staffText: z.boolean().optional(),
});

export const zSpacing = z.object({
  /** Verovio evenNoteSpacing: space notes and rests without weighting duration. */
  evenNoteSpacing: z.boolean().optional(),
  /** Verovio spacingLinear: horizontal space that grows with duration. */
  linear: z.number().min(0).max(1).optional(),
  /** Verovio spacingNonLinear: how much longer notes get more room. */
  nonLinear: z.number().min(0).max(1).optional(),
  /** Verovio spacingSystem: minimum space between systems, in staff spaces. */
  system: z.number().min(0).max(12).optional(),
});

/** Settings a single part can override. */
export const zPartFormatting = z.object({
  /** Staff space in millimetres, or "auto": the largest that keeps the part on one page. */
  staffSize: z.union([zAuto, z.number().min(0.8).max(8)]).optional(),
  /** Systems on the page, or "auto": as many as fit, about five measures each. */
  systemsPerPage: z.union([zAuto, z.number().int().min(1).max(24)]).optional(),
  spacing: zSpacing.optional(),
  fingering: zFingering.optional(),
  cleanup: zCleanup.optional(),
});

const zManualOffset = z.object({
  target: z.union([z.object({ id: z.string() }), z.object({ voltaIndex: z.number().int().nonnegative() })]),
  identity: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
});
export type ManualOffset = z.infer<typeof zManualOffset>;

export const zFormattingProfile = zPartFormatting.extend({
  profileVersion: z.literal(FORMATTING_PROFILE_VERSION),
  fitArea: z
    .object({
      widthMm: z.number().min(20).max(1000),
      heightMm: z.number().min(20).max(1000),
    })
    .optional(),
  manualOffsets: z.record(z.string(), z.array(zManualOffset)).optional(),
  arrangementMarginMm: z.number().min(5).max(20).optional(),
  arrangementStaffSizeMm: z.number().min(0.8).max(8).optional(),
  arrangementStaffSpacing: z.number().int().min(0).max(48).optional(),
  /** Overrides keyed by part name (the name of the part in the .mscz). */
  parts: z.record(z.string(), zPartFormatting).optional(),
});

export type FingeringSettings = z.infer<typeof zFingering>;
export type CleanupSettings = z.infer<typeof zCleanup>;
export type PartFormatting = z.infer<typeof zPartFormatting>;
export type FormattingProfile = z.infer<typeof zFormattingProfile>;

export const DEFAULT_FORMATTING_PROFILE: FormattingProfile = Object.freeze({
  profileVersion: FORMATTING_PROFILE_VERSION,
});
