/**
 * Failures the export app can explain to a user, as opposed to bugs.
 *
 * The code is what crosses the IPC boundary: Electron flattens Error
 * subclasses and prefixes their message ("Error invoking remote method ..."),
 * so the renderer cannot recover a class or its properties from a rejection.
 * electron/ipc.ts therefore catches these and returns a plain result object;
 * src/export-app translates the code to pt-BR, per CONTRIBUTING.md's language
 * policy, which keeps library messages in English.
 */
export const EXPORT_ERROR_CODES = [
  "EXPORT_FILE_NOT_FOUND",
  "EXPORT_NOT_A_SCORE",
  "EXPORT_UNSUPPORTED_VERSION",
  "EXPORT_METADATA_UNREADABLE",
  "EXPORT_NO_PARTS",
  "EXPORT_SCORE_CHANGED",
  "EXPORT_DESTINATION_NOT_DIRECTORY",
  "EXPORT_DESTINATION_NOT_EMPTY",
  "EXPORT_ASSETS_MISSING",
  "EXPORT_MSCORE_NOT_SET",
  "EXPORT_FAILED",
] as const;

export type ExportErrorCode = (typeof EXPORT_ERROR_CODES)[number];

export class ExportError extends Error {
  constructor(
    readonly code: ExportErrorCode,
    message: string,
    readonly meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ExportError";
  }
}

/** The shape sent to the renderer in place of a rejection. */
export interface ExportFailure {
  ok: false;
  code: ExportErrorCode;
  message: string;
  meta: Record<string, unknown>;
}

export type ExportOutcome<T> = { ok: true; value: T } | ExportFailure;

export function toExportFailure(error: unknown): ExportFailure {
  if (error instanceof ExportError) {
    return { ok: false, code: error.code, message: error.message, meta: error.meta };
  }
  return {
    ok: false,
    code: "EXPORT_FAILED",
    message: error instanceof Error ? error.message : String(error),
    meta: {},
  };
}
