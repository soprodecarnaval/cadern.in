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
import type { Part, ScoreLibrary, ScoreSession } from "../../../lib/browserScore/types";
import { packageMscx, readMsczIdentityBytes, stampMsczIdentityBytes } from "../../../lib/msczIdentity";
import { safeFilename } from "../../../lib/partFiles";
import { caderninhoPartTransform } from "../../../lib/scoreRender/partTransform";
import { libraryOptionsFor, resolvePartFormatting, sheetLayoutFor } from "../../../lib/scoreRender/profile";
import { profileWithChoices, renderForUpload } from "../../../lib/scoreRender/renderForUpload";
import { commitUpload, prepareUpload, type UploadContext, type UploadFlowServices } from "../../../lib/uploadFlow";
import { MAX_SCORE_BYTES, choicesFrom, initialState, partRows, rowsFromStored, type EnviarState, type PartRow, type Step, type StoredPart } from "./enviarState";
import { zMetajson } from "../../../../types/metajson";

export { initialState, MAX_SCORE_BYTES, type EnviarState } from "./enviarState";
export type { Preview, Status } from "./enviarState";

export type EnviarDeps = {
  context: UploadContext;
  user: User | null;
  services: UploadFlowServices & Pick<typeof import("../../../lib/db"), "getScoreRevision">;
  loadLibrary: (options: ReturnType<typeof libraryOptionsFor> & { signal: AbortSignal }) => Promise<ScoreLibrary>;
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

export function useEnviarFlow(deps: EnviarDeps) {
  const [state, setState] = useState<EnviarState>(initialState);
  const library = useRef<ScoreLibrary | null>(null);
  const session = useRef<ScoreSession | null>(null);
  const parts = useRef<readonly Part[]>([]);
  const bytes = useRef<Uint8Array | null>(null);
  const midiUrls = useRef(new Map<number, string>());
  const controller = useRef(new AbortController());
  const effective = useRef<FormattingProfile>(DEFAULT_FORMATTING_PROFILE);
  const rendered = useRef(new Map<number, string>());
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const update = useCallback((change: Partial<EnviarState> | ((state: EnviarState) => Partial<EnviarState>)) =>
    setState((current) => ({ ...current, ...(typeof change === "function" ? change(current) : change) })), []);
  const fail = useCallback((error: unknown) => {
    const text = message(error);
    if (text) {update({ status: { kind: "error", message: text } });}
  }, [update]);

  const closeSession = useCallback(async () => {
    const open = session.current;
    session.current = null;
    rendered.current.clear();
    await open?.dispose().catch(() => undefined);
  }, []);

  const openSession = useCallback(async (fileName: string, signal: AbortSignal) => {
    const open = await library.current!.open(
      { bytes: bytes.current!, format: fileName.toLowerCase().endsWith(".mscx") ? "mscx" : "mscz", name: fileName },
      {
        signal,
        compatibility: "allowUnverified",
        partTransform: (input) => caderninhoPartTransform(effective.current)(input),
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
    stored?: { profile: FormattingProfile; parts: readonly StoredPart[]; title: string },
  ) => {
    controller.current.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    clearMidi();
    update({ fileName, midi: {}, status: { kind: "opening" } });
    await closeSession();
    try {
      const fileBytes = await read(signal);
      signal.throwIfAborted();
      if (fileBytes.length > MAX_SCORE_BYTES) {throw new Error("O arquivo passa de 32 MB, o limite para abrir no navegador.");}
      bytes.current = fileBytes;
      if (!library.current) {
        update({ fileName, status: { kind: "loading-engine" } });
        const loaded = await depsRef.current.loadLibrary({ ...libraryOptionsFor(DEFAULT_FORMATTING_PROFILE), signal });
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
        title: stored?.title ?? safeFilename(tags.workTitle?.trim() || fileName.replace(/\.(mscz|mscx)$/i, "")),
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
          { profile: manifest?.formatting ?? DEFAULT_FORMATTING_PROFILE, parts: manifest?.parts ?? [], title: safeFilename(title) },
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
        return [choice.ordinal, part ? JSON.stringify(resolvePartFormatting(profile, part.name)) : ""];
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
          ordinal,
          svg: previous?.svg ?? null,
          pages: previous?.pages ?? 0,
          layout: previous?.layout ?? null,
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
            const page = await open.renderPage(view, 1, { expectedRevision: revision, signal, background: "white" });
            if (signal.aborted || session.current !== open || superseded) {return;}
            rendered.current.set(ordinal, signature);
            // Pages name their shared text fonts; a preview shown as an image needs them embedded (014).
            const svg = page.portability === "shared-fonts" ? withTextFonts(page.svg, await textFontCss()) : page.svg;
            update((current) => ({ previews: { ...current.previews, [ordinal]: { ordinal, svg, pages: pageCount, layout: page.layout ?? null, warnings: page.warnings, rendering: false } } }));
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
        const prepared = await prepareUpload(context, { title: state.title, ...(source ? { source } : {}) }, user.uid, services);
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
  }, [fail, openSession, state.fileName, state.title, update]);

  const send = useCallback(async () => {
    const { context, user, services, upload } = depsRef.current;
    if (!user || !state.target || !bytes.current || !library.current) {return;}
    const signal = controller.current.signal;
    update({ status: { kind: "rendering" } });
    try {
      // renderForUpload opens its own session: the engine holds one score at a time.
      await closeSession();
      const { parsed } = await renderForUpload(bytes.current, state.fileName ?? "partitura.mscz", state.profile, choicesFrom(state.rows), {
        library: library.current,
        signal,
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
  }, [closeSession, fail, state.fileName, state.profile, state.rows, state.target, update]);

  const listen = useCallback(async (ordinal: number) => {
    const open = session.current;
    const part = parts.current.find((candidate) => candidate.ordinal === ordinal);
    if (!open || !part) {return;}
    const signal = controller.current.signal;
    try {
      const { revision } = await open.getPages({ kind: "part", partId: part.id }, { signal });
      const midi = await open.exportMidi({ kind: "part", partId: part.id }, { expectedRevision: revision, signal });
      if (signal.aborted || session.current !== open) {return;}
      const url = URL.createObjectURL(new Blob([midi.midi], { type: "audio/midi" }));
      const previous = midiUrls.current.get(ordinal);
      if (previous) {URL.revokeObjectURL(previous);}
      midiUrls.current.set(ordinal, url);
      update((current) => ({ midi: { ...current.midi, [ordinal]: url } }));
    } catch (error) {
      if (!signal.aborted) {fail(error);}
    }
  }, [fail, update]);

  const cancel = useCallback(() => {
    controller.current.abort();
    controller.current = new AbortController();
    rendered.current.clear();
    update((current) => ({
      status: { kind: "idle" },
      previews: Object.fromEntries(Object.entries(current.previews).map(([key, preview]) => [key, { ...preview, rendering: false }])),
    }));
  }, [update]);

  return {
    state,
    chooseFile,
    goTo,
    send,
    cancel,
    listen,
    setRows: (rows: PartRow[]) => update({ rows }),
    setProfile: (profile: FormattingProfile) => update({ profile }),
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
