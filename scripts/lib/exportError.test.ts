import { describe, expect, it } from "vitest";
import {
  EXPORT_ERROR_CODES,
  ExportError,
  toExportFailure,
} from "./exportError";
import { translateWarning } from "../../src/lib/warningMessages";

describe("toExportFailure", () => {
  it("carries the code and meta of a typed failure", () => {
    const failure = toExportFailure(
      new ExportError("EXPORT_DESTINATION_NOT_EMPTY", "…", { files: ["a.svg"] }),
    );

    expect(failure).toEqual({
      ok: false,
      code: "EXPORT_DESTINATION_NOT_EMPTY",
      message: "…",
      meta: { files: ["a.svg"] },
    });
  });

  it("maps an unexpected error to the generic code", () => {
    // Bugs must still reach the user as something, not vanish.
    expect(toExportFailure(new Error("boom"))).toMatchObject({
      code: "EXPORT_FAILED",
      message: "boom",
    });
  });

  it("handles a thrown non-Error", () => {
    expect(toExportFailure("boom")).toMatchObject({
      code: "EXPORT_FAILED",
      message: "boom",
    });
  });
});

describe("export error translations", () => {
  // The renderer translates by code; a code with no pt-BR string would reach
  // the user as undefined.
  it.each(EXPORT_ERROR_CODES)("%s has a pt-BR message", (code) => {
    const message = translateWarning(code, {
      version: "3.6.2",
      minimum: 4,
      files: "a.svg",
      missing: "b.midi",
      message: "x",
    });

    expect(message).toBeTruthy();
    expect(message).not.toContain("undefined");
    expect(message).not.toMatch(/\{\w+\}/);
  });
});
