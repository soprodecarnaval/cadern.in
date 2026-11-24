// The send screen's flow (ticket 012): open the file in the browser-score
// engine, list its parts, render previews with the formatting profile
// (re-rendering only the parts whose settings changed, debounced), then
// render for upload, revalidate and upload. Every engine call takes the
// current AbortSignal; leaving the page disposes the engine.
import type { User } from "firebase/auth";
import { fontFaceCss, loadTextFonts, withTextFonts } from "../../../lib/sharedFonts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormattingProfile } from "../../../../types/formattingProfile";
import { DEFAULT_FORMATTING_PROFILE } from "../../../../types/formattingProfile";
import type { Part, PartCatalog, ScoreLibrary, ScoreSession } from "../../../lib/browserScore/types";
import { packageMscx, readMsczIdentityBytes, stampMsczIdentityBytes } from "../../../lib/msczIdentity";
import { safeFilename } from "../../../lib/partFiles";
import { caderninhoPartTransform } from "../../../lib/scoreRender/partTransform";
import { libraryOptionsFor, resolvePartFormatting, sheetLayoutFor } from "../../../lib/scoreRender/profile";
import { arrangementOptions, profileWithChoices, renderForUpload } from "../../../lib/scoreRender/renderForUpload";
import { commitUpload, prepareUpload, type UploadContext, type UploadFlowServices } from "../../../lib/uploadFlow";
import { MAX_SCORE_BYTES, choicesFrom, initialState, metadataFromTags, partRows, rowsFromStored, type EnviarState, type PartRow, type Step, type StoredPart } from "./enviarState";
import { zMetajson } from "../../../../types/metajson";
import type { ScoreMetadata } from "../../../../types/docs";
import { moveMarking, type MarkingMove } from "./collisionSvg";
import type { Instrument } from "../../../../types/instrument";

export { initialState, MAX_SCORE_BYTES, type EnviarState } from "./enviarState";
export type { Preview, Status } from "./enviarState";

export type EnviarDeps = {
  context: UploadContext;
  user: User | null;
  services: UploadFlowServices & Pick<typeof import("../../../lib/db"), "getScoreRevision">;
  loadLibrary: (options: ReturnType<typeof libraryOptionsFor> & { signal: AbortSignal; partPlayback: boolean }) => Promise<ScoreLibrary>;
  upload: Parameters<typeof commitUpload>[4]["upload"];
};


const RERENDER_DELAY_MS = 400;

let textFontCssCache: Promise<string> | null = null;
/** The shared text fonts as @font-face CSS, loaded once; empty if they can't be loaded. */
const textFontCss = () => (textFontCssCache ??= loadTextFonts().then(fontFaceCss).catch(() => ""));

const message = (error: unknown) => {
  if (error && typeof error === "object" && "name" in error && (error as { name: string }).name === "AbortError") {return null;}
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "ABORTED" || code === "DISPOSED") {return null;}
    if (code === "RESOURCE_LIMIT") {return "O arquivo é grande demais para abrir no navegador (máximo de 32 MB).";}
    if (code === "INVALID_INPUT" || code === "UNSUPPORTED_FORMAT") {return "Não foi possível ler este arquivo. Envie o .mscz salvo no MuseScore.";}
    if (code === "ASSET_LOAD_FAILED" || code === "ASSET_MISMATCH") {return "Não foi possível carregar o motor de partituras. Recarregue a página e tente de novo.";}
    if (code === "ENGINE_FATAL") {return "O motor de partituras parou. Recarregue a página e tente de novo.";}
  }
  return error instanceof Error ? error.message : String(error);
};

/** What a part's pages depend on: its resolved settings and the instrument it is filed under. */
const pageSignature = (profile: FormattingProfile, partName: string, instrument: Instrument | undefined) =>
  JSON.stringify([instrument ?? null, resolvePartFormatting(profile, partName)]);

export function useEnviarFlow(deps: EnviarDeps) {
  const [state, setState] = useState<EnviarState>(initialState);
  const library = useRef<ScoreLibrary | null>(null);
  const session = useRef<ScoreSession | null>(null);
  const parts = useRef<readonly Part[]>([]);
  const catalogRef = useRef<PartCatalog | null>(null);
  const bytes = useRef<Uint8Array | null>(null);
  const midiUrls = useRef(new Map<number, string>());
  const controller = useRef(new AbortController());
  const effective = useRef<FormattingProfile>(DEFAULT_FORMATTING_PROFILE);
  const rendered = useRef(new Map<number, string>());
  const depsRef = useRef(deps);
  depsRef.current = deps;
  // The instrument each part is filed under: it, not the file's instrument, drives the formatting.
  const instruments = useRef(new Map<number, Instrument>());
  instruments.current = new Map(choicesFrom(state.rows).map((choice) => [choice.ordinal, choice.instrument]));

  const update = useCallback((change: Partial<EnviarState> | ((state: EnviarState) => Partial<EnviarState>)) =>
    setState((current) => ({ ...current, ...(typeof change === "function" ? change(current) : change) })), []);
  const fail = useCallback((error: unknown) => {
    const text = message(error);
    if (text) {update({ status: { kind: "error", message: text } });}
  }, [update]);

  const closeSession = useCallback(async () => {
    const open = session.current;
    session.current = null;
    catalogRef.current = null;
    rendered.current.clear();
    await open?.dispose().catch(() => undefined);
  }, []);

  const openSession = useCallback(async (fileName: string, signal: AbortSignal) => {
    const open = await library.current!.open(
      { bytes: bytes.current!, format: fileName.toLowerCase().endsWith(".mscx") ? "mscx" : "mscz", name: fileName },
      {
        signal,
        compatibility: "allowUnverified",
        partTransform: (input) => caderninhoPartTransform(effective.current, undefined, (part) => instruments.current.get(part.ordinal))(input),
        partLayout: (part) => sheetLayoutFor(resolvePartFormatting(effective.current, part.name)),
      },
    );
    if (signal.aborted) {
      await open.dispose();
      signal.throwIfAborted();
    }
    session.current = open;
    const catalog = await open.prepareParts({ policy: "preserveExistingOrGenerateIfNone", expectedRevision: 0, signal });
    signal.throwIfAborted();
    parts.current = catalog.parts;
    catalogRef.current = catalog;
    return { session: open, catalog };
  }, []);

  const clearMidi = useCallback(() => {
    for (const url of midiUrls.current.values()) {URL.revokeObjectURL(url);}
    midiUrls.current.clear();
  }, []);

  // Leaving the page cancels whatever runs and frees the engine.
  useEffect(() => () => {
    controller.current.abort();
    void session.current?.dispose().catch(() => undefined);
    void library.current?.dispose().catch(() => undefined);
    clearMidi();
  }, [clearMidi]);

  /** Opens score bytes in the engine and lists its parts; `stored` restores a reformatted revision's choices. */
  const openBytes = useCallback(async (
    read: (signal: AbortSignal) => Promise<Uint8Array>,
    fileName: string,
    stored?: { profile: FormattingProfile; parts: readonly StoredPart[]; metadata: ScoreMetadata },
  ) => {
    controller.current.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    clearMidi();
    update({ fileName, midi: {}, previews: {}, collisions: {}, status: { kind: "opening" } });
    await closeSession();
    try {
      const fileBytes = await read(signal);
      signal.throwIfAborted();
      if (fileBytes.length > MAX_SCORE_BYTES) {throw new Error("O arquivo passa de 32 MB, o limite para abrir no navegador.");}
      bytes.current = fileBytes;
      if (!library.current) {
        update({ fileName, status: { kind: "loading-engine" } });
        const loaded = await depsRef.current.loadLibrary({ ...libraryOptionsFor(DEFAULT_FORMATTING_PROFILE), signal, partPlayback: true });
        if (signal.aborted) {
          await loaded.dispose();
          signal.throwIfAborted();
        }
        library.current = loaded;
      }
      update({ fileName, status: { kind: "opening" } });
      const { session: open, catalog } = await openSession(fileName, signal);
      const tags = open.importInfo.metaTags;
      const rows = partRows(catalog.parts);
      update({
        step: "partes",
        status: { kind: "idle" },
        metadata: stored?.metadata ?? metadataFromTags(tags, fileName),
        rows: stored ? rowsFromStored(rows, stored.parts, stored.profile) : rows,
        ...(stored ? { profile: stored.profile } : {}),
        previews: {},
        target: null,
        checks: null,
        result: null,
      });
    } catch (error) {
      if (!signal.aborted) {fail(error);}
    }
  }, [clearMidi, closeSession, fail, openSession, update]);

  // Reformat (ticket 013): load the base revision's .mscz and the profile it was rendered with.
  // Revisions from before the browser upload have no profile and open with the default one.
  const reformatLoaded = useRef(false);
  useEffect(() => {
    const { context, services } = depsRef.current;
    if (context.mode !== "reformat" || !context.scoreId || !context.baseRevisionId || reformatLoaded.current) {return;}
    reformatLoaded.current = true;
    void (async () => {
      try {
        update({ status: { kind: "opening" } });
        const revision = await services.getScoreRevision(context.scoreId!, context.baseRevisionId!);
        if (!revision?.mscz.url) {throw new Error("Não foi possível encontrar esta versão da partitura.");}
        const metajson = revision.metajson.url
          ? zMetajson.safeParse(await fetch(revision.metajson.url).then((response) => (response.ok ? response.json() : null)).catch(() => null))
          : null;
        const manifest = metajson?.success ? metajson.data : null;
        const title = revision.metadata?.title ?? context.scoreId!;
        await openBytes(
          (signal) => fetch(revision.mscz.url, { signal }).then(async (response) => {
            if (!response.ok) {throw new Error("Não foi possível baixar o arquivo desta versão.");}
            return new Uint8Array(await response.arrayBuffer());
          }),
          `${safeFilename(title)}.mscz`,
          {
            profile: manifest?.formatting ?? DEFAULT_FORMATTING_PROFILE,
            parts: manifest?.parts ?? [],
            metadata: { title: safeFilename(title), composer: revision.metadata?.composer ?? "", sub: revision.metadata?.sub ?? "", tags: revision.metadata?.tags ?? [] },
          },
        );
      } catch (error) {
        fail(error);
      }
    })();
  }, [fail, openBytes, update]);

  const chooseFile = useCallback(async (file: File) => {
    if (file.size > MAX_SCORE_BYTES) {
      update({ status: { kind: "error", message: "O arquivo passa de 32 MB, o limite para abrir no navegador." } });
      return;
    }
    if (!/\.(mscz|mscx)$/i.test(file.name)) {
      update({ status: { kind: "error", message: "Envie um arquivo .mscz (ou .mscx) salvo no MuseScore." } });
      return;
    }
    await openBytes(() => file.arrayBuffer().then((buffer) => new Uint8Array(buffer)), file.name);
  }, [openBytes, update]);

  // Previews: re-render the included parts whose resolved settings changed, after a pause.
  const signatures = useMemo(() => {
    const choices = choicesFrom(state.rows);
    const profile = profileWithChoices(state.profile, parts.current, choices);
    return {
      profile,
      parts: Object.fromEntries(choices.map((choice) => {
        const part = parts.current.find((candidate) => candidate.ordinal === choice.ordinal);
        return [choice.ordinal, part ? pageSignature(profile, part.name, choice.instrument) : ""];
      })),
    };
  }, [state.profile, state.rows]);

  useEffect(() => {
    if (state.step !== "formatacao" || !session.current) {return;}
    const open = session.current;
    const stale = Object.entries(signatures.parts).filter(([ordinal, signature]) => rendered.current.get(Number(ordinal)) !== signature);
    const pending = new Set(stale.map(([ordinal]) => Number(ordinal)));
    update((current) => ({
      previews: Object.fromEntries(Object.keys(signatures.parts).map((key) => {
        const ordinal = Number(key);
        const previous = current.previews[ordinal];
        return [ordinal, {
          ...previous,
          ordinal,
          svg: previous?.svg ?? null,
          pages: previous?.pages ?? 0,
          layout: previous?.layout ?? null,
          automaticFingeringSize: previous?.automaticFingeringSize,
          warnings: previous?.warnings ?? [],
          rendering: pending.has(ordinal),
        }];
      })),
    }));
    if (!stale.length) {return;}
    const signal = controller.current.signal;
    let superseded = false;
    const timer = setTimeout(() => {
      void (async () => {
        effective.current = signatures.profile;
        for (const [key, signature] of stale) {
          const ordinal = Number(key);
          const part = parts.current.find((candidate) => candidate.ordinal === ordinal);
          // A newer change or a cancel supersedes this pass.
          if (!part || signal.aborted || session.current !== open || superseded) {return;}
          try {
            open.invalidate({ kind: "part", partId: part.id });
            const view = { kind: "part" as const, partId: part.id };
            const { revision, pageCount } = await open.getPages(view, { signal });
            const page = await open.renderPage(view, 1, { expectedRevision: revision, signal });
            // Pages name their shared text fonts; a preview shown as an image needs them embedded (014).
            const fontCss = page.portability === "shared-fonts" ? await textFontCss() : "";
            const svg = fontCss ? withTextFonts(page.svg, fontCss) : page.svg;
            if (signal.aborted || session.current !== open || superseded) {return;}
            rendered.current.set(ordinal, signature);
            const automaticFingeringSize = resolvePartFormatting(signatures.profile, part.name).fingering.size === "auto"
              ? page.layout?.fingeringScale
              : undefined;
            update((current) => ({ previews: { ...current.previews, [ordinal]: { ordinal, svg, pageSvg: page.svg, fontCss, signature, pages: pageCount, layout: page.layout ?? null, automaticFingeringSize, warnings: page.warnings, rendering: false } } }));
          } catch (error) {
            const text = message(error);
            if (text && !signal.aborted && !superseded) {update((current) => ({ previews: { ...current.previews, [ordinal]: { ...current.previews[ordinal], ordinal, rendering: false, error: text } } }));}
          }
        }
      })();
    }, RERENDER_DELAY_MS);
    return () => {
      clearTimeout(timer);
      superseded = true;
    };
  }, [signatures, state.step, update]);

  const goTo = useCallback(async (step: Step) => {
    const signal = controller.current.signal;
    if (step === "formatacao" && !session.current && bytes.current) {
      try {
        update({ status: { kind: "opening" } });
        await openSession(state.fileName ?? "partitura.mscz", signal);
        update({ status: { kind: "idle" } });
      } catch (error) {
        if (!signal.aborted) {fail(error);}
        return;
      }
    }
    if (signal.aborted) {return;}
    if (step === "enviar") {
      const { context, user, services } = depsRef.current;
      if (!user) {
        update({ step, status: { kind: "error", message: "Entre na sua conta para enviar partituras." } });
        return;
      }
      update({ step, status: { kind: "preparing" }, target: null, checks: null });
      try {
        const archive = bytes.current && state.fileName?.toLowerCase().endsWith(".mscx")
          ? packageMscx(bytes.current)
          : bytes.current;
        const source = archive ? readMsczIdentityBytes(archive) : null;
        const prepared = await prepareUpload(context, { title: state.metadata.title, ...(source ? { source } : {}) }, user.uid, services);
        if (signal.aborted) {return;}
        if (!prepared.ok) {
          update({ status: { kind: "error", message: prepared.reason } });
          return;
        }
        update({ status: { kind: "idle" }, target: prepared.target, checks: prepared.checks });
      } catch (error) {
        if (!signal.aborted) {fail(error);}
      }
      return;
    }
    update({ step, status: { kind: "idle" } });
  }, [fail, openSession, state.fileName, state.metadata.title, update]);

  const send = useCallback(async () => {
    const { context, user, services, upload } = depsRef.current;
    if (!user || !state.target || !bytes.current || !library.current) {return;}
    const signal = controller.current.signal;
    update({ status: { kind: "rendering" } });
    try {
      // Reuse the preview session: pages already drawn with the final settings are not drawn again.
      const fileName = state.fileName ?? "partitura.mscz";
      if (!session.current || !catalogRef.current) {await openSession(fileName, signal);}
      const open = session.current!;
      const { parsed } = await renderForUpload(bytes.current, fileName, state.profile, choicesFrom(state.rows), {
        signal,
        metadata: state.metadata,
        arrangementRows: state.rows,
        editedPages: Object.entries(state.collisions).flatMap(([key, draft]) => {
          const ordinal = Number(key);
          const svg = draft.history.at(-1);
          if (!svg) {return [];}
          if (draft.signature !== signatures.parts[ordinal]) {
            throw new Error("A formatação mudou. Confira as correções manuais antes de enviar.");
          }
          return [{ ordinal, page: 1, original: draft.original, svg }];
        }),
        openSession: {
          session: open,
          catalog: catalogRef.current!,
          renderer: library.current.renderer,
          useProfile: (profile) => {
            effective.current = profile;
            for (const part of catalogRef.current?.parts ?? []) {
              const signature = pageSignature(profile, part.name, instruments.current.get(part.ordinal));
              if (rendered.current.get(part.ordinal) !== signature) {
                open.invalidate({ kind: "part", partId: part.id });
                rendered.current.delete(part.ordinal);
              }
            }
          },
        },
        onProgress: (progress) => {if (!signal.aborted) {update({ status: { kind: "rendering", progress } });}},
      });
      signal.throwIfAborted();
      update({ status: { kind: "uploading" } });
      const result = await commitUpload(context, parsed, state.target, user, {
        services,
        upload,
        signal,
        onProgress: (progress) => {if (!signal.aborted) {update({ status: { kind: "uploading", progress } });}},
        stampMscz: async (file, identity) => new File([stampMsczIdentityBytes(new Uint8Array(await file.arrayBuffer()), identity)], file.name, { type: file.type }),
      });
      if (signal.aborted) {return;}
      if (!result.ok) {
        update({ status: { kind: "error", message: result.reason } });
        return;
      }
      update({ step: "feito", status: { kind: "idle" }, result: { identity: result.identity, target: result.target, repin: result.repin } });
    } catch (error) {
      if (!signal.aborted) {fail(error);}
    }
  }, [signatures.parts, fail, openSession, state.collisions, state.fileName, state.metadata, state.profile, state.rows, state.target, update]);

  const previewArrangement = useCallback(async (signal: AbortSignal) => {
    const open = session.current;
    const catalog = catalogRef.current;
    if (!open || !catalog) {throw new Error("Abra a partitura para visualizar o arranjo.");}
    const { pages, staffSpaceMm } = await open.renderArrangement({
      ...arrangementOptions({
        arrangementMarginMm: state.profile.arrangementMarginMm,
        arrangementStaffSizeMm: state.profile.arrangementStaffSizeMm,
        arrangementStaffSpacing: state.profile.arrangementStaffSpacing,
      }, state.rows),
      expectedRevision: catalog.revision,
      signal,
    });
    const css = await textFontCss();
    signal.throwIfAborted();
    return { svg: css ? withTextFonts(pages[0], css) : pages[0], staffSpaceMm };
  }, [state.profile.arrangementMarginMm, state.profile.arrangementStaffSizeMm, state.profile.arrangementStaffSpacing, state.rows]);

  const listen = useCallback(async (ordinal: number) => {
    const open = session.current;
    const part = parts.current.find((candidate) => candidate.ordinal === ordinal);
    const preview = state.previews[ordinal];
    if (!open || !part || !preview?.pageSvg || preview.rendering || preview.error ||
        preview.signature !== signatures.parts[ordinal]) {return;}
    if (state.midi[ordinal]?.pageSvg === preview.pageSvg) {return;}
    const pageSvg = preview.pageSvg;
    const signal = controller.current.signal;
    try {
      const { revision } = await open.getPages({ kind: "part", partId: part.id }, { signal });
      const playback = await open.getPartPlayback(part.id, { expectedRevision: revision, signal });
      const midi = playback ?? await open.exportMidi({ kind: "part", partId: part.id }, { expectedRevision: revision, signal });
      if (signal.aborted || session.current !== open) {return;}
      const url = URL.createObjectURL(new Blob([midi.midi], { type: "audio/midi" }));
      const previous = midiUrls.current.get(ordinal);
      if (previous) {URL.revokeObjectURL(previous);}
      midiUrls.current.set(ordinal, url);
      update((current) => ({
        midi: { ...current.midi, [ordinal]: { url, pageSvg, frames: playback?.frames ?? [] } },
      }));
    } catch (error) {
      if (!signal.aborted) {fail(error);}
    }
  }, [fail, signatures.parts, state.midi, state.previews, update]);

  const cancel = useCallback(() => {
    controller.current.abort();
    controller.current = new AbortController();
    rendered.current.clear();
    update((current) => ({
      status: { kind: "idle" },
      previews: Object.fromEntries(Object.entries(current.previews).map(([key, preview]) => [key, { ...preview, rendering: false }])),
    }));
  }, [update]);

  const changeFormatting = (rows: PartRow[], profile: FormattingProfile) => {
    const choices = choicesFrom(rows);
    const nextProfile = profileWithChoices(profile, parts.current, choices);
    const nextCollisions = Object.fromEntries(choices.flatMap((choice) => {
      const draft = state.collisions[choice.ordinal];
      const part = parts.current.find((candidate) => candidate.ordinal === choice.ordinal);
      return draft && part && draft.signature === pageSignature(nextProfile, part.name, choice.instrument)
        ? [[choice.ordinal, draft] as const] : [];
    }));
    if (Object.keys(nextCollisions).length !== Object.keys(state.collisions).length &&
        !window.confirm("Esta alteração apaga as correções manuais nas partes afetadas. Continuar?")) {return false;}
    update({ rows, profile, collisions: nextCollisions });
    return true;
  };

  const editCollision = (ordinal: number, action: MarkingMove | "undo" | "reset") => {
    update((current) => {
      const preview = current.previews[ordinal];
      if (!preview?.pageSvg || !preview.signature || preview.rendering || preview.error ||
          preview.signature !== signatures.parts[ordinal]) {return {};}
      const existing = current.collisions[ordinal];
      const draft = existing?.original === preview.pageSvg && existing.signature === preview.signature
        ? existing : { original: preview.pageSvg, signature: preview.signature, history: [] };
      let history: readonly string[] = [];
      if (action === "undo") {history = draft.history.slice(0, -1);}
      else if (action !== "reset") {
        const svg = moveMarking(draft.history.at(-1) ?? draft.original, action);
        if (!svg) {return {};}
        history = [...draft.history, svg];
      }
      const collisions = { ...current.collisions };
      if (history.length) {collisions[ordinal] = { ...draft, history };}
      else {delete collisions[ordinal];}
      return { collisions };
    });
  };

  return {
    state,
    chooseFile,
    goTo,
    send,
    cancel,
    listen,
    previewArrangement,
    setRows: (rows: PartRow[], profile = state.profile) => changeFormatting(rows, profile),
    setProfile: (profile: FormattingProfile) => changeFormatting(state.rows, profile),
    editCollision,
    setMetadata: (metadata: ScoreMetadata) => update({ metadata }),
    setEditing: (editing: number | null) => update({ editing }),
    dismissError: () => update({ status: { kind: "idle" } }),
    reset: () => {
      controller.current.abort();
      controller.current = new AbortController();
      void closeSession();
      clearMidi();
      bytes.current = null;
      parts.current = [];
      setState(initialState());
    },
  };
}
