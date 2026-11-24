// One call from a raw .mscz to the ParsedScore that resolveUploadTarget and
// uploadScore accept (ticket 010): open → prepare parts → clean-up, tuba
// notation and fingerings per part → fitted pages → MIDI → identity, with the
// formatting profile and renderer recorded in the v2 .metajson.
import type { FormattingProfile } from "../../../types/formattingProfile";
import type { Instrument } from "../../../types/instrument";
import { METAJSON_VERSION, type Metajson } from "../../../types/metajson";
import type { Warning as AppWarning } from "../../result";
import type { Part, PartCatalog, RendererInfo, ScoreLibrary, ScoreSession, SheetLayoutResult, Warning } from "../browserScore/types";
import { pirataInstrument } from "../instruments";
import { packageMscx, readMsczIdentityBytes } from "../msczIdentity";
import { buildPartBasenames, safeFilename } from "../partFiles";
import type { ParsedPart, ParsedScore } from "../parseUploadedFiles";
import { caderninhoPartTransform, partInstrumentSettings, type PartTransformReport } from "./partTransform";
import { libraryOptionsFor, resolvePartFormatting, sheetLayoutFor } from "./profile";

/** What the user chose for one part of the score; parts not listed are not uploaded. */
export type PartChoice = {
  /** The part's ordinal in the score (1-based), stable across sessions of the same file. */
  ordinal: number;
  /** The instrument the part is filed under; "pirata" is added when it gets fingerings. */
  instrument: Instrument;
  /** Display name; defaults to the part name in the file. */
  name?: string;
  /** Fingerings on or off; defaults to the profile (by instrument). */
  fingerings?: boolean;
};

export type PartRenderReport = {
  ordinal: number;
  name: string;
  instrument: Instrument;
  basename: string;
  pages: number;
  layout: SheetLayoutResult | null;
  warnings: readonly Warning[];
  transform: PartTransformReport | null;
};

export type RenderReport = { parts: PartRenderReport[]; profile: FormattingProfile };

export type RenderProgress = { step: "open" | "parts" | "render" | "midi" | "done"; done: number; total: number; part?: string };

export type RenderOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
  /** A library created with `libraryOptionsFor(profile)`; created (and disposed) here when absent. */
  library?: ScoreLibrary;
  /** Creates the library when none is given (the app passes loadScoreLibrary). */
  createLibrary?: (options: ReturnType<typeof libraryOptionsFor>) => Promise<ScoreLibrary>;
  /**
   * An open session of the same file (the send screen's), so pages already drawn for the preview
   * are reused instead of drawn again. Its transforms must read the profile `useProfile` receives;
   * `useProfile` is called with the final profile before any page is read, and should forget the
   * pages drawn with other settings (session.invalidate). Not disposed here.
   */
  openSession?: {
    session: ScoreSession;
    catalog: PartCatalog;
    /** The library's renderer record, for the .metajson. */
    renderer: RendererInfo;
    useProfile: (profile: FormattingProfile) => void;
  };
};

const metajsonFields = (tags: Readonly<Record<string, string>>) => ({
  composer: tags.composer ?? "",
  previousSource: tags.source ?? "",
  poet: tags.lyricist ?? "",
});

/** The profile with the user's fingering choices written in as part overrides. */
export function profileWithChoices(
  profile: FormattingProfile,
  parts: readonly Pick<Part, "ordinal" | "name">[],
  choices: readonly PartChoice[],
): FormattingProfile {
  const overrides = { ...profile.parts };
  for (const choice of choices) {
    const part = parts.find((candidate) => candidate.ordinal === choice.ordinal);
    if (!part || choice.fingerings === undefined) {continue;}
    const current = overrides[part.name] ?? {};
    overrides[part.name] = { ...current, fingering: { ...current.fingering, enabled: choice.fingerings } };
  }
  return Object.keys(overrides).length ? { ...profile, parts: overrides } : { ...profile };
}

export async function renderForUpload(
  bytes: Uint8Array,
  fileName: string,
  profile: FormattingProfile,
  choices: readonly PartChoice[],
  options: RenderOptions = {},
): Promise<{ parsed: ParsedScore; report: RenderReport }> {
  const { signal, onProgress } = options;
  if (!choices.length) {throw new Error("Choose at least one part");}
  onProgress?.({ step: "open", done: 0, total: choices.length });
  const reused = options.openSession;
  const library = reused
    ? null
    : options.library ??
      (await (options.createLibrary ?? ((o) => import("../scoreEngine").then((m) => m.loadScoreLibrary(o))))(
        libraryOptionsFor(profile),
      ));
  const owned = !reused && !options.library;
  try {
    // The catalog is needed before the profile can be completed, so it is read first and the
    // transforms look the effective profile up when the pages are drawn.
    let effective = profile;
    const transforms = new Map<string, PartTransformReport>();
    const session = reused
      ? reused.session
      : await library!.open(
          { bytes, format: fileName.toLowerCase().endsWith(".mscx") ? "mscx" : "mscz", name: fileName },
          {
            signal,
            compatibility: "allowUnverified",
            partTransform: (input) =>
              caderninhoPartTransform(effective, (report) => transforms.set(input.part.id, report))(input),
            partLayout: (part) => sheetLayoutFor(resolvePartFormatting(effective, part.name)),
          },
        );
    try {
      const catalog = reused
        ? reused.catalog
        : await session.prepareParts({ policy: "preserveExistingOrGenerateIfNone", expectedRevision: 0, signal });
      onProgress?.({ step: "parts", done: 0, total: choices.length });
      effective = profileWithChoices(profile, catalog.parts, choices);
      reused?.useProfile(effective);
      const renderer = reused?.renderer ?? library!.renderer;
      const chosen = [...choices]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((choice) => {
          const part = catalog.parts.find((candidate) => candidate.ordinal === choice.ordinal);
          if (!part) {throw new Error(`Part ${choice.ordinal} is not in the score`);}
          const formatting = resolvePartFormatting(effective, part.name);
          const { settings } = partInstrumentSettings(part);
          const fingered =
            !!settings?.fingering &&
            (formatting.fingering.enabled === "byInstrument" || formatting.fingering.enabled);
          return { part, choice, instrument: pirataInstrument(choice.instrument, fingered) };
        });

      const tags = session.importInfo.metaTags;
      const stem = fileName.replace(/\.(mscz|mscx)$/i, "");
      const title = safeFilename(tags.workTitle?.trim() || stem);
      const basenames = buildPartBasenames(
        title,
        chosen.map(({ part, instrument }) => ({ id: part.id, instrument })),
      );
      const fileMap = new Map<string, File>();
      const parts: ParsedPart[] = [];
      const reportParts: PartRenderReport[] = [];
      const metajsonParts: Metajson["parts"] = [];

      for (const [index, { part, choice, instrument }] of chosen.entries()) {
        const name = choice.name?.trim() || part.name;
        onProgress?.({ step: "render", done: index, total: chosen.length, part: name });
        const view = { kind: "part" as const, partId: part.id };
        const { pageCount } = await session.getPages(view, { signal });
        const basename = basenames.get(part.id)!;
        const svg: string[] = [];
        const svgNames: string[] = [];
        let layout: SheetLayoutResult | null = null;
        let warnings: readonly Warning[] = [];
        for (let page = 1; page <= pageCount; page++) {
          const rendered = await session.renderPage(view, page, { expectedRevision: catalog.revision, signal });
          const key = `parts/${basename}-${page}.svg`;
          const fileName = `${basename}-${page}.svg`;
          fileMap.set(key, new File([rendered.svg], fileName, { type: "image/svg+xml" }));
          svg.push(key);
          svgNames.push(fileName);
          layout ??= rendered.layout ?? null;
          if (page === 1) {warnings = rendered.warnings;}
        }
        onProgress?.({ step: "midi", done: index, total: chosen.length, part: name });
        const midi = await session.exportMidi(view, { expectedRevision: catalog.revision, signal });
        fileMap.set(`parts/${basename}.midi`, new File([midi.midi], `${basename}.midi`, { type: "audio/midi" }));
        parts.push({ name, basename, instrument, svg, midi: `parts/${basename}.midi` });
        metajsonParts.push({ name, instrument, svg: svgNames, midi: `${basename}.midi` });
        reportParts.push({
          ordinal: part.ordinal,
          name,
          instrument,
          basename,
          pages: pageCount,
          layout,
          warnings: [...warnings, ...midi.warnings],
          transform: transforms.get(part.id) ?? null,
        });
      }

      const scoreMidi = await session.exportMidi({ kind: "score" }, { expectedRevision: catalog.revision, signal });
      fileMap.set("midi", new File([scoreMidi.midi], `${title}.midi`, { type: "audio/midi" }));
      const archive = fileName.toLowerCase().endsWith(".mscx") ? packageMscx(bytes) : bytes;
      fileMap.set("mscz", new File([archive], `${title}.mscz`, { type: "application/octet-stream" }));
      const source = readMsczIdentityBytes(archive);
      const fields = metajsonFields(tags);
      const metajson: Metajson = {
        version: METAJSON_VERSION,
        ...(source ? { source } : {}),
        ...fields,
        parts: metajsonParts,
        formatting: effective,
        renderer: { ...renderer, fonts: renderer.fonts.map((font) => ({ ...font })) },
      };
      fileMap.set(
        "metajson",
        new File([JSON.stringify(metajson, null, 2)], `${title}.metajson`, { type: "application/json" }),
      );
      const warnings: AppWarning[] = [];
      onProgress?.({ step: "done", done: chosen.length, total: chosen.length });
      return {
        parsed: {
          title,
          composer: fields.composer,
          sub: fields.previousSource,
          // As parseUploadedFiles reads the .metajson.
          tags: fields.poet.split(",").map((tag) => tag.trim()),
          parts,
          fileMap,
          warnings,
          ...(source ? { source } : {}),
        },
        report: { parts: reportParts, profile: effective },
      };
    } finally {
      if (!reused) {await session.dispose();}
    }
  } finally {
    if (owned) {await library!.dispose();}
  }
}
