/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any --
   Worker messages and webmscore results are untyped; shapes are validated at run time. */
// SPDX-License-Identifier: GPL-3.0-only
import { inspect, defaultLimits } from './input';
import { strToU8, zipSync } from 'fflate';
import { ScoreError, hasOwn, capabilities, type Warning, type PartId, type LibraryOptions, type ScoreLibrary, type ScoreSession, type SongbookInfo, type Part, type PartCatalog, type Operation, type View, type MusicXmlPart, type MusicXmlExport } from './types';
import { partMusicXml } from './parts';
import { composeSheet, MUSIC_AREA, SHEET, type SheetFonts } from './sheet';
export { inspect } from './input';
export * from './types';

/** Package already-rendered pages; callers decide whether their batch is complete. */
export function createSvgArchive(pages: readonly { filename: string; svg: string }[]): Uint8Array {
    const files: Record<string, Uint8Array> = Object.create(null);
    if (!Array.isArray(pages) || !pages.length) {throw new ScoreError('INVALID_INPUT', 'createSvgArchive', 'No pages to archive');}
    for (const page of pages) {
        if (!page || typeof page.filename !== 'string' || !/^[a-z0-9-]+\.svg$/.test(page.filename) || typeof page.svg !== 'string' || hasOwn(files, page.filename)) {throw new ScoreError('INVALID_INPUT', 'createSvgArchive', 'Invalid or duplicate page filename');}
        files[page.filename] = strToU8(page.svg);
    }
    return zipSync(files);
}

// Fail closed on SVG features that can depend on fonts, external resources,
// active content, or browser-specific CSS. This checks the returned artifact,
// not whether the native importer substituted a font or dropped content.
async function validatePortableSvg(doc: Document): Promise<void> {
    const fail = () => { throw new ScoreError('UNSUPPORTED_CAPABILITY', 'renderPage', 'SVG contains unsupported or unresolved resources'); };
    const allowed = new Set(['svg', 'g', 'path', 'polyline', 'polygon', 'line', 'rect', 'circle', 'ellipse', 'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'use', 'image', 'title', 'desc', 'text', 'tspan', 'style']);
    const ids = new Set<string>(), references: string[] = [];
    if (doc.doctype || Array.from(doc.childNodes).some(node => node.nodeType === Node.PROCESSING_INSTRUCTION_NODE)) {fail();}
    // Text is allowed only in fonts embedded in the SVG itself: a <style> may hold
    // nothing but @font-face rules whose source is a data: WOFF2 font.
    const embedded = new Set<string>();
    const fontFace = /@font-face\s*\{\s*font-family:\s*(["'])([A-Za-z0-9 _-]+)\1;\s*src:\s*url\(data:(?:application\/font-woff2|font\/woff2);(?:charset=utf-8;)?base64,([A-Za-z0-9+/=\s]+)\)\s*format\(["']?woff2["']?\);\s*(?:font-(?:weight|style):\s*[a-z0-9]+;\s*)*\}/g;
    for (const style of Array.from(doc.querySelectorAll('style'))) {
        if (Array.from(style.attributes).some(attr => attr.name !== 'type' || attr.value !== 'text/css') || style.children.length) {fail();}
        const rest = (style.textContent ?? '').replace(fontFace, (_rule, _quote: string, family: string, data: string) => {
            try { if (!atob(data.replace(/\s+/g, '')).startsWith('wOF2')) {fail();} } catch { fail(); }
            embedded.add(family);
            return '';
        });
        if (rest.trim()) {fail();}
    }
    const generic = new Set(['serif', 'sans-serif', 'monospace']);
    const fontOf = (element: Element | null): string | null => {
        for (; element; element = element.parentElement) {
            const value = element.getAttribute('font-family');
            if (value !== null) {return value;}
        }
        return null;
    };
    for (const text of Array.from(doc.querySelectorAll('text, tspan'))) {
        if (!text.textContent?.trim()) {continue;}
        const families = (fontOf(text) ?? '').split(',').map(name => name.trim().replace(/^["']|["']$/g, ''));
        if (!embedded.has(families[0]) || families.slice(1).some(name => !generic.has(name) && !embedded.has(name))) {fail();}
    }
    for (const element of Array.from(doc.querySelectorAll('*'))) {
        if (element.namespaceURI !== 'http://www.w3.org/2000/svg' || !allowed.has(element.localName)) {fail();}
        const id = element.getAttribute('id');
        if (id) { if (ids.has(id)) {fail();} ids.add(id); }
        for (const attr of Array.from(element.attributes)) {
            if (/^on/i.test(attr.name) || attr.localName === 'style' || attr.localName === 'base' || attr.localName === 'src' || /\\|@/.test(attr.value)) {fail();}
            if (attr.localName === 'href') {
                if (element.localName === 'image') {
                    const image = /^data:image\/(png|jpeg);base64,([a-z0-9+/]+={0,2})$/i.exec(attr.value);
                    if (!image) {fail();}
                    try {
                        const bytes = atob(image![2]);
                        if (image![1].toLowerCase() === 'png' ? !bytes.startsWith('\x89PNG\r\n\x1a\n') : !bytes.startsWith('\xff\xd8\xff')) {fail();}
                        const data = Uint8Array.from(bytes, char => char.charCodeAt(0));
                        const bitmap = await createImageBitmap(new Blob([data], { type: `image/${image![1].toLowerCase()}` }));
                        bitmap.close();
                    } catch { fail(); }
                } else if (/^#[a-zA-Z_][\w:.-]*$/.test(attr.value)) {references.push(attr.value.slice(1));}
                else {fail();}
            }
            const remainder = attr.value.replace(/url\(\s*(['"]?)#([a-zA-Z_][\w:.-]*)\1\s*\)/gi, (_match, _quote, id: string) => { references.push(id); return ''; });
            if (/url\s*\(/i.test(remainder)) {fail();}
        }
        if (element.localName === 'image' && !element.hasAttribute('href') && !element.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) {fail();}
    }
    if (references.some(id => !ids.has(id))) {fail();}
}

type NativeScore = { destroy(): void; metadata(): Promise<Metadata>; generateExcerpts(): Promise<void>; setExcerptId(id: number): Promise<void>; npages(): Promise<number>; saveSvg(page: number, background: boolean): Promise<string>; saveXml(): Promise<string> };
type NativePart = { instrumentName: string; name: string; instrumentId?: string };
type Metadata = { excerpts: { title: string; parts: NativePart[] }[]; parts: (NativePart & { isVisible: string })[] };

function fileStem(value: string, fallback: string): string {
    return value.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '').toLowerCase() || fallback;
}

/** Read the part list of engine MusicXML; reject anything that is not a coherent partwise score. */
function musicXmlParts(xml: string): Omit<MusicXmlPart, 'catalogPart'>[] {
    const fail = (): never => { throw new ScoreError('UNSUPPORTED_CAPABILITY', 'exportMusicXml', 'Engine returned invalid MusicXML'); };
    if (typeof xml !== 'string' || !xml) {fail();}
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root.localName !== 'score-partwise') {fail();}
    const bodies = new Map(Array.from(root.children).filter(e => e.localName === 'part').map(e => [e.getAttribute('id'), e]));
    const list = Array.from(root.querySelector(':scope > part-list')?.children ?? []).filter(e => e.localName === 'score-part');
    if (!list.length || list.length !== bodies.size) {fail();}
    return list.map(scorePart => {
        const id = scorePart.getAttribute('id') ?? '';
        const body = bodies.get(id) ?? fail();
        const transpose = body.querySelector('measure > attributes > transpose');
        const integer = (name: string) => { const text = transpose?.querySelector(name)?.textContent?.trim(); return text && /^-?\d+$/.test(text) ? Number(text) : null; };
        const chromatic = integer('chromatic');
        return {
            id, name: scorePart.querySelector(':scope > part-name')?.textContent?.trim() ?? '',
            instrumentNames: Array.from(scorePart.querySelectorAll(':scope > score-instrument > instrument-name'), e => e.textContent?.trim() ?? '').filter(Boolean),
            // Written-to-sounding interval in semitones, including any octave change.
            transposeChromatic: chromatic === null ? null : chromatic + 12 * (integer('octave-change') ?? 0)
        };
    });
}
type Engine = {
    ready: Promise<void>;
    load(format: string, bytes: Uint8Array, fonts: Uint8Array[], layout: boolean): Promise<NativeScore>;
    setLogLevel(level: number): Promise<void>;
};
let mainOwner = false;

const SHEET_FONTS = { medium: 'fonts/roboto-latin-500-normal.woff2', bold: 'fonts/roboto-latin-700-normal.woff2' } as const;

async function assets(options: LibraryOptions): Promise<{ base: URL; sheetFonts: SheetFonts }> {
    const kept = new Map<string, Uint8Array>();
    const base = new URL(options.assets.manifestUrl);
    async function fetchBytes(url: URL) {
        if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol)) {
            throw new ScoreError('ASSET_LOAD_FAILED', 'create', 'Assets must share the manifest HTTP origin');
        }
        const response = await fetch(url, { signal: options.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok) {
            throw new ScoreError('ASSET_LOAD_FAILED', 'create', 'Asset unavailable');
        }
        return new Uint8Array(await response.arrayBuffer());
    }
    const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes(base)));
    const required = ['worker.js', 'src/index.js', 'webmscore.mjs',
        'webmscore.lib.wasm', 'webmscore.lib.mem.wasm', 'webmscore.lib.data',
        'renderer.js', 'verovio/verovio-module.mjs', 'verovio/verovio.mjs', SHEET_FONTS.medium, SHEET_FONTS.bold];
    if (manifest.engine !== options.adapter || manifest.protocolVersion !== 1 || !Array.isArray(manifest.assets)
        || manifest.assets.length < required.length) {
        throw new ScoreError('ASSET_MISMATCH', 'create', 'Invalid asset manifest');
    }
    const paths = new Set<string>();
    for (const asset of manifest.assets) {
        if (typeof asset.path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(asset.path)
            || asset.path.startsWith('/') || asset.path.split('/').includes('..')
            || paths.has(asset.path) || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
            throw new ScoreError('ASSET_MISMATCH', 'create', 'Invalid asset entry');
        }
        paths.add(asset.path);
        const bytes = await fetchBytes(new URL(asset.path, base));
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== asset.sha256) {
            throw new ScoreError('ASSET_MISMATCH', 'create', 'Asset digest mismatch');
        }
        if (Object.values(SHEET_FONTS).includes(asset.path)) {kept.set(asset.path, bytes);}
    }
    if (required.some(path => !paths.has(path))
        || options.assets.workerUrl.href !== new URL('worker.js', base).href) {
        throw new ScoreError('ASSET_MISMATCH', 'create', 'Missing or mismatched engine entry');
    }
    return { base, sheetFonts: { medium: kept.get(SHEET_FONTS.medium)!, bold: kept.get(SHEET_FONTS.bold)! } };
}

const validSize = (size: { widthMm: number; heightMm: number }) =>
    [size.widthMm, size.heightMm].every(mm => Number.isFinite(mm) && mm >= 20 && mm <= 1000);

export async function createScoreLibrary(options: LibraryOptions): Promise<ScoreLibrary> {
    if (options.adapter !== 'webmscore-1.2.1' || !['worker', 'main-thread'].includes(options.execution)) {
        throw new ScoreError('UNSUPPORTED_CAPABILITY', 'create', 'Unknown adapter or execution mode');
    }
    const partPageStyle = options.partPageStyle ?? 'songbook';
    if (!['songbook', 'fitted', 'plain'].includes(partPageStyle)) {throw new ScoreError('INVALID_INPUT', 'create', 'partPageStyle must be "songbook", "fitted" or "plain"');}
    const partPageSize = options.partPageSize ?? 'B6';
    if (partPageSize !== 'B6' && partPageSize !== 'score') {
        const { marginsMm } = partPageSize;
        if (!validSize(partPageSize) || (marginsMm && (marginsMm.length !== 4 || marginsMm.some(m => !Number.isFinite(m) || m < 0)
            || marginsMm[1] + marginsMm[3] >= partPageSize.widthMm || marginsMm[0] + marginsMm[2] >= partPageSize.heightMm))) {
            throw new ScoreError('INVALID_INPUT', 'create', 'partPageSize must be "B6", "score" or a page of 20–1000 mm with margins inside it');
        }
    }
    const fitArea = options.fitArea ?? { widthMm: MUSIC_AREA.widthMm, heightMm: MUSIC_AREA.heightMm };
    if (!validSize(fitArea)) {throw new ScoreError('INVALID_INPUT', 'create', 'fitArea must be 20–1000 mm on each side');}
    const limits = { ...defaultLimits, ...options.limits };
    for (const value of Object.values(limits)) {
        if (!Number.isSafeInteger(value) || value <= 0) {
            throw new ScoreError('INVALID_INPUT', 'create', 'Limits must be positive safe integers');
        }
    }
    // Snapshot fonts before any asynchronous initialization.
    const fonts = (options.fonts ?? []).map(font => {
        if (!(font.bytes instanceof Uint8Array) || !font.bytes.length) {
            throw new ScoreError('INVALID_INPUT', 'create', 'Expected nonempty font bytes');
        }
        return font.bytes.slice();
    });
    let ownsMain = false;
    if (options.execution === 'main-thread') {
        if (mainOwner) {
            throw new ScoreError('SCORE_ALREADY_OPEN', 'create', 'A main-thread engine already has an owner');
        }
        mainOwner = ownsMain = true;
    }
    let worker: Worker | undefined;
    let assetBase: URL | undefined;
    let sheetFonts: SheetFonts | undefined;
    let engine: Engine | undefined;
    let nativeScore: NativeScore | undefined;
    let disposed = false;
    let live = false;
    let next = 0;
    let queue: Promise<unknown> = Promise.resolve();
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: unknown): void }>();

    function stop(code = 'DISPOSED', operation = 'runtime') {
        disposed = true;
        worker?.terminate();
        if (nativeScore) {
            nativeScore.destroy();
            nativeScore = undefined;
        }
        if (ownsMain) {
            mainOwner = ownsMain = false;
        }
        for (const item of pending.values()) {
            item.reject(new ScoreError(code, operation, 'Runtime terminated; reopen retained input in a new library', true));
        }
        pending.clear();
    }

    function call(method: string, params: unknown[] = [], signal?: AbortSignal): Promise<unknown> {
        const execute = async () => {
            if (disposed) {
                throw new ScoreError('DISPOSED', method, 'Library disposed', true);
            }
            if (signal?.aborted) {
                throw new ScoreError('ABORTED', method, 'Operation aborted before dispatch');
            }
            if (engine) {
                // Main-thread calls cannot be interrupted once synchronous Wasm starts.
                try {
                    if (method === 'load') {
                        nativeScore = await engine.load(params[0] as string, params[1] as Uint8Array, fonts, true);
                    } else if (method === 'metadata') {
                        await nativeScore!.setExcerptId(-1);
                        return await nativeScore!.metadata();
                    } else if (method === 'generateExcerpts') {
                        await nativeScore!.generateExcerpts();
                    } else if (method === 'pages' || method === 'svg') {
                        await nativeScore!.setExcerptId(params[0] as number);
                        return method === 'pages' ? await nativeScore!.npages() : await nativeScore!.saveSvg(params[1] as number, params[2] as boolean);
                    } else if (method === 'musicxml') {
                        await nativeScore!.setExcerptId(-1);
                        return await nativeScore!.saveXml();
                    } else if (method === 'renderMusicXml') {
                        const { renderMusicXml } = await import(/* @vite-ignore */ new URL('renderer.js', assetBase).href);
                        return await renderMusicXml(...params);
                    } else if (method === 'renderSheet') {
                        const { renderSheet } = await import(/* @vite-ignore */ new URL('renderer.js', assetBase).href);
                        return await renderSheet(...params);
                    } else if (method === 'destroy') {
                        nativeScore?.destroy();
                        nativeScore = undefined;
                    }
                    return;
                } catch {
                    stop('ENGINE_FATAL', method);
                    throw new ScoreError('ENGINE_FATAL', method, 'Native engine failure', true);
                }
            }
            return new Promise((resolve, reject) => {
                const id = ++next;
                const abort = () => stop('ABORTED', method);
                const timer = setTimeout(() => stop('RESOURCE_LIMIT', method), limits.operationMs);
                const clean = () => {
                    clearTimeout(timer);
                    signal?.removeEventListener('abort', abort);
                };
                pending.set(id, {
                    resolve: value => { clean(); resolve(value); },
                    reject: error => { clean(); reject(error); }
                });
                signal?.addEventListener('abort', abort, { once: true });
                worker!.postMessage({ id, method, params });
            });
        };
        const result = queue.then(execute);
        queue = result.catch(() => undefined);
        return result;
    }

    try {
        const loaded = await assets(options);
        const base = assetBase = loaded.base;
        sheetFonts = loaded.sheetFonts;
        if (options.execution === 'worker') {
            worker = new Worker(options.assets.workerUrl, { type: 'module' });
            worker.onerror = () => stop('ENGINE_FATAL');
            worker.onmessageerror = () => stop('ENGINE_FATAL');
            worker.onmessage = ({ data }) => {
                const item = pending.get(data.id);
                if (!item) {
                    return;
                }
                if (data.error) {
                    stop('ENGINE_FATAL');
                } else {
                    pending.delete(data.id);
                    item.resolve(data.result);
                }
            };
            await call('ready', [], options.signal);
        } else {
            engine = (await import(/* @vite-ignore */ new URL('src/index.js', base).href)).default as Engine;
            await engine.ready;
            await engine.setLogLevel(0);
        }
        if (options.signal?.aborted) {
            throw new ScoreError('ABORTED', 'create', 'Initialization aborted');
        }
    } catch (error) {
        stop();
        if (error instanceof ScoreError) {
            throw error;
        }
        throw new ScoreError(options.signal?.aborted ? 'ABORTED' : 'ASSET_LOAD_FAILED', 'create', 'Engine initialization failed');
    }

    return {
        async open(input, operation = {}) {
            if (disposed) {
                throw new ScoreError('DISPOSED', 'open', 'Library disposed', true);
            }
            if (operation.signal?.aborted) {
                throw new ScoreError('ABORTED', 'open', 'Import aborted');
            }
            if (live) {
                throw new ScoreError('SCORE_ALREADY_OPEN', 'open', 'Dispose the current score first');
            }
            live = true;
            try {
                if (!(input?.bytes instanceof Uint8Array)) {
                    throw new ScoreError('INVALID_INPUT', 'open', 'Expected Uint8Array score bytes');
                }
                const owned = input.bytes.slice();
                const info = inspect(owned, input.format, limits);
                if (operation.compatibility !== undefined && !['strict', 'allowUnverified'].includes(operation.compatibility)) {
                    throw new ScoreError('INVALID_INPUT', 'open', 'Unknown compatibility mode');
                }
                if (operation.compatibility !== 'allowUnverified') {
                    throw new ScoreError('UNSUPPORTED_VERSION', 'open', 'No versions have completed fidelity validation');
                }
                const songbook: SongbookInfo = {};
                if (operation.songbook !== undefined) {
                    if (!operation.songbook || typeof operation.songbook !== 'object') {throw new ScoreError('INVALID_INPUT', 'open', 'songbook must be an object');}
                    for (const key of ['title', 'subtitle', 'composer', 'genre', 'number'] as const) {
                        const value = operation.songbook[key];
                        if (value === undefined) {continue;}
                        if (typeof value !== 'string' || value.length > 200) {throw new ScoreError('INVALID_INPUT', 'open', `songbook.${key} must be a string of at most 200 characters`);}
                        songbook[key] = value;
                    }
                }
                await call('load', [input.format, info.bytes, fonts], operation.signal);
                let closed = false;
                let closing: Promise<void> | undefined;
                const unsupported = (capability: string) => (): Promise<never> => Promise.reject(
                    new ScoreError(closed || disposed ? 'DISPOSED' : 'UNSUPPORTED_CAPABILITY',
                        capability, closed || disposed ? 'Session disposed' : 'Capability belongs to a later ticket',
                        disposed, capability));
                let revision = 0;
                let origin: Part['origin'] = 'existing';
                let parts: Part[] = [];
                let sessionQueue: Promise<unknown> = Promise.resolve();
                const run = <T>(operation: string, signal: AbortSignal | undefined, action: () => Promise<T>): Promise<T> => {
                    const result = sessionQueue.then(() => {
                        if (closed || disposed) {throw new ScoreError('DISPOSED', operation, 'Session disposed', disposed);}
                        if (signal?.aborted) {throw new ScoreError('ABORTED', operation, 'Operation aborted before dispatch');}
                        return action();
                    });
                    sessionQueue = result.catch(() => undefined);
                    return result;
                };
                const catalog = (metadata: Metadata): PartCatalog => {
                    if (parts.length !== metadata.excerpts.length) {
                        parts = metadata.excerpts.map((excerpt, index) => ({
                            id: crypto.randomUUID(), name: info.savedPartNames[excerpt.title] || excerpt.title?.trim() || `Part ${index + 1}`,
                            ordinal: index + 1, origin,
                            instrumentNames: (excerpt.parts || []).map(part => part.instrumentName || part.name).filter(Boolean),
                            staffCount: null
                        }));
                    }
                    return { revision, parts: parts.map(part => ({ ...part, instrumentNames: [...part.instrumentNames] })),
                        coverage: 'unknown', warnings: [{ code: 'PART_COVERAGE_UNKNOWN', message: 'Excerpt coverage and staff counts cannot be established from engine metadata.' },
                            { code: 'PART_FIDELITY_UNVERIFIED', message: 'Part notation and layout fidelity have not been established for this file.' },
                            ...(metadata.parts.some(part => part.isVisible !== 'true') ? [{ code: 'PART_VISIBILITY_UNCERTAIN', message: 'Generated parts may include hidden instruments.' }] : [])] };
                };
                const support = Object.fromEntries(capabilities.map(capability => [capability,
                    Object.freeze((capability.startsWith('import.') || capability.startsWith('parts.') || capability === 'svg.page' || capability === 'export.musicxml') ? { available: true }
                        : { available: false, reason: 'Not implemented by this milestone' })])) as ScoreSession['capabilities'];
                const viewIndex = async (view: View, signal?: AbortSignal): Promise<{ index: number; metadata?: Metadata }> => {
                    if (view?.kind === 'score') {return { index: -1 };}
                    if (view?.kind !== 'part' || typeof view.partId !== 'string') {throw new ScoreError('INVALID_INPUT', 'svg.page', 'Invalid view');}
                    const metadata = await call('metadata', [], signal) as Metadata;
                    catalog(metadata);
                    const index = parts.findIndex(part => part.id === view.partId);
                    if (index < 0) {throw new ScoreError('PART_NOT_FOUND', 'svg.page', 'Part is not in this session');}
                    return { index, metadata };
                };
                // Full-score MusicXML of the current revision, exported once and shared by parts.
                let scoreXml: { revision: number; xml: string; parts: ReturnType<typeof musicXmlParts> } | undefined;
                const fullScore = async (signal?: AbortSignal) => {
                    if (scoreXml?.revision !== revision) {
                        const xml = await call('musicxml', [], signal) as string;
                        scoreXml = { revision, xml, parts: musicXmlParts(xml) };
                    }
                    return scoreXml;
                };
                // MusicXML part ids for each catalog part, matched by engine identity
                // against the master parts (which MusicXML lists in score order).
                const key = (part: NativePart) => [part.name, part.instrumentName, part.instrumentId ?? ''].join('\u0000');
                const musicXmlTargets = (metadata: Metadata, ids: readonly string[]) => {
                    const masterKeys = metadata.parts.length === ids.length ? metadata.parts.map(key) : [];
                    return metadata.excerpts.map(excerpt => {
                        const targets = (excerpt.parts ?? []).map(part => {
                            const at = masterKeys.indexOf(key(part));
                            return at >= 0 && masterKeys.lastIndexOf(key(part)) === at ? ids[at] : null;
                        });
                        return targets.length && targets.every(Boolean) && new Set(targets).size === targets.length ? targets as string[] : null;
                    });
                };
                // Songbook header: caller values first, then the score's meta tags (booklet convention), then the MusicXML.
                const sheetHeader = (credits: { title: string; composer: string; lyricist: string }, part: Part) => {
                    const tag = (name: string) => info.metaTags[name] ?? '';
                    const source = /:\/\//.test(tag('source')) ? '' : tag('source');
                    const fileTitle = (info.entryName || input.name.replace(/\.(mscx|mscz)$/i, '')).replace(/[_]+/g, ' ');
                    return {
                        title: songbook.title ?? (tag('workTitle') || credits.title || tag('movementTitle') || fileTitle),
                        subtitle: songbook.subtitle ?? (tag('subtitle') || source),
                        composer: songbook.composer ?? (tag('composer') || credits.composer),
                        genre: songbook.genre ?? (tag('lyricist') || credits.lyricist),
                        number: (songbook.number ?? tag('workNumber')).trim(),
                        instrument: part.name
                    };
                };
                // Part pages are drawn by the MusicXML renderer, one part at a time.
                const rendered = new Map<PartId, { revision: number; pages: string[]; warnings: Warning[]; geometry: { widthMm: number; heightMm: number } }>();
                const partPages = async (index: number, metadata: Metadata, signal?: AbortSignal) => {
                    const part = parts[index];
                    const cached = rendered.get(part.id);
                    if (cached?.revision === revision) {return cached;}
                    const score = await fullScore(signal);
                    const ids = musicXmlTargets(metadata, score.parts.map(p => p.id))[index];
                    if (!ids) {throw new ScoreError('UNSUPPORTED_CAPABILITY', 'getPages', 'Part could not be matched to the full-score MusicXML');}
                    let built: ReturnType<typeof partMusicXml>;
                    try { built = partMusicXml(score.xml, ids, partPageSize, partPageStyle); } catch { throw new ScoreError('UNSUPPORTED_CAPABILITY', 'getPages', 'Part MusicXML could not be built'); }
                    const sheet = partPageStyle === 'songbook';
                    const fitted = sheet || partPageStyle === 'fitted';
                    const area = sheet ? { widthMm: MUSIC_AREA.widthMm, heightMm: MUSIC_AREA.heightMm } : { widthMm: fitArea.widthMm, heightMm: fitArea.heightMm };
                    const output = await (fitted
                        ? call('renderSheet', [built.musicXml, area, built.measureWeights], signal)
                        : call('renderMusicXml', [built.musicXml, built.geometry], signal)) as { pages?: unknown; staffSpaceMm?: unknown };
                    if (!output || !Array.isArray(output.pages) || output.pages.some(page => typeof page !== 'string')) {throw new ScoreError('UNSUPPORTED_CAPABILITY', 'getPages', 'The renderer could not read the part MusicXML');}
                    let pages = output.pages as string[];
                    let geometry: { widthMm: number; heightMm: number } = built.geometry;
                    const sheetWarnings: Warning[] = [];
                    if (fitted) {
                        geometry = area;
                        if (sheet) {
                            const header = sheetHeader(built.credits, part);
                            pages = pages.map(page => composeSheet(page, header, sheetFonts!));
                            geometry = SHEET;
                            if (!header.number) {sheetWarnings.push({ code: 'SHEET_NUMBER_MISSING', message: 'No song number was given; the sheet shows none.' });}
                        }
                        if (pages.length > 1) {sheetWarnings.push({ code: 'SHEET_OVERFLOW', message: `The part does not fit one sheet at the smallest staff size and continues on ${pages.length} sheets.` });}
                        else if (typeof output.staffSpaceMm === 'number' && output.staffSpaceMm < 1.7) {sheetWarnings.push({ code: 'SHEET_STAFF_REDUCED', message: `The staff was reduced to ${output.staffSpaceMm.toFixed(2)} mm per space to fit one sheet.` });}
                    }
                    const warnings: Warning[] = [
                        { code: 'PART_RENDERED_FROM_MUSICXML', message: 'Drawn by Verovio 6.4.0 from the full-score MusicXML. Spacing, system breaks and engraving differ from MuseScore.' },
                        { code: 'PART_FIDELITY_UNVERIFIED', message: 'Imported notation and layout fidelity are not established for this file.' }];
                    if (origin === 'existing') {warnings.push({ code: 'MUSICXML_FROM_FULL_SCORE', message: 'This saved part is drawn from the full score; part-only content and part layout are not included.' });}
                    if (built.copiedMarkings) {warnings.push({ code: 'SYSTEM_MARKINGS_COPIED', message: `${built.copiedMarkings} tempo, jump and rehearsal markings were copied from the top part of the score.` });}
                    warnings.push(...sheetWarnings);
                    if (!fitted && !built.geometryFromScore) {warnings.push({ code: 'PAGE_SIZE_DEFAULTED', message: partPageSize === 'score' ? 'The score has no usable page layout; A4 pages were used.' : 'The score has no usable page layout; default margins and staff size were used.' });}
                    const entry = { revision, pages, warnings, geometry };
                    rendered.set(part.id, entry);
                    return entry;
                };
                const pageCountFor = async (index: number, signal?: AbortSignal) => {
                    const count = await call('pages', [index], signal) as number;
                    if (!Number.isSafeInteger(count) || count < 0) {throw new ScoreError('UNSUPPORTED_CAPABILITY', 'getPages', 'Engine returned an invalid page count');}
                    return count;
                };
                return Object.freeze({
                    id: crypto.randomUUID(),
                    capabilities: Object.freeze(support),
                    importInfo: Object.freeze({
                        inputFormat: input.format, fileVersion: info.fileVersion,
                        compatibility: 'unverified' as const,
                        warnings: Object.freeze(info.warnings.map(warning => Object.freeze(warning))),
                        metaTags: Object.freeze({ ...info.metaTags })
                    }),
                    listParts(operation: Operation = {}) {
                        return run('listParts', operation.signal, async () => catalog(await call('metadata', [], operation.signal) as Metadata));
                    },
                    prepareParts(operation: Operation & { policy: 'preserveExistingOrGenerateIfNone'; expectedRevision: number }) {
                        return run('prepareParts', operation?.signal, async () => {
                            if (!operation || operation.policy !== 'preserveExistingOrGenerateIfNone') {throw new ScoreError('INVALID_INPUT', 'prepareParts', 'Unknown part preparation policy');}
                            if (operation.expectedRevision !== revision) {throw new ScoreError('STALE_REVISION', 'prepareParts', 'Score revision changed');}
                            let metadata = await call('metadata', [], operation.signal) as Metadata;
                            if (!metadata.excerpts.length) {
                                await call('generateExcerpts', [], operation.signal);
                                metadata = await call('metadata') as Metadata;
                                if (metadata.excerpts.length) { origin = 'generated'; revision++; }
                            }
                            return catalog(metadata);
                        });
                    },
                    getPages(view: View, operation: Operation = {}) {
                        return run('getPages', operation.signal, async () => {
                            const { index, metadata } = await viewIndex(view, operation.signal);
                            const pageCount = index < 0 ? await pageCountFor(index, operation.signal) : (await partPages(index, metadata!, operation.signal)).pages.length;
                            return { revision, pageCount };
                        });
                    },
                    renderPage(view: View, pageNumber: number, operation: Operation & { expectedRevision: number; background?: 'transparent' | 'white' }) {
                        return run('renderPage', operation?.signal, async () => {
                            if (!operation || operation.expectedRevision !== revision) {throw new ScoreError('STALE_REVISION', 'renderPage', 'Score revision changed');}
                            if (operation.background !== undefined && !['white', 'transparent'].includes(operation.background)) {throw new ScoreError('INVALID_INPUT', 'renderPage', 'Unknown background');}
                            const { index, metadata } = await viewIndex(view, operation.signal);
                            const drawn = index < 0 ? undefined : await partPages(index, metadata!, operation.signal);
                            const pageCount = drawn ? drawn.pages.length : await pageCountFor(index, operation.signal);
                            if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {throw new ScoreError('PAGE_OUT_OF_RANGE', 'renderPage', 'Page number is out of range');}
                            const nativeSvg = drawn ? drawn.pages[pageNumber - 1] : await call('svg', [index, pageNumber - 1, operation.background === 'white'], operation.signal) as string;
                            const doc = new DOMParser().parseFromString(nativeSvg, 'image/svg+xml');
                            const root = doc.documentElement;
                            if (root.localName !== 'svg' || doc.querySelector('parsererror')) {throw new ScoreError('UNSUPPORTED_CAPABILITY', 'renderPage', 'Renderer returned invalid SVG');}
                            await validatePortableSvg(doc);
                            if (drawn) {
                                // Verovio with mmOutput: the viewBox is the page in millimetres, rounded to
                                // its internal units; the physical size is the score's page size.
                                const [x, y, w, h] = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
                                if (x !== 0 || y !== 0 || !(w > 0 && h > 0) || Math.abs(w - drawn.geometry.widthMm) > 1 || Math.abs(h - drawn.geometry.heightMm) > 1) {throw new ScoreError('UNSUPPORTED_CAPABILITY', 'renderPage', 'Renderer returned invalid SVG');}
                                root.setAttribute('width', `${drawn.geometry.widthMm}mm`);
                                root.setAttribute('height', `${drawn.geometry.heightMm}mm`);
                                if (operation.background === 'white') {
                                    const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
                                    for (const [name, value] of [['x', '0'], ['y', '0'], ['width', String(w)], ['height', String(h)], ['fill', 'white']]) {rect.setAttribute(name, value);}
                                    // Behind every drawing: after the leading <desc>/<defs>.
                                    const lead = root.querySelector(':scope > defs') ?? root.querySelector(':scope > desc');
                                    if (lead) {lead.after(rect);} else {root.prepend(rect);}
                                }
                            }
                            const dimension = (name: string) => {
                                const match = /^([\d.]+)(mm|in|pt|px)?$/.exec(root.getAttribute(name) || '');
                                if (!match) {return NaN;}
                                // webmscore 1.2.1 uses MuseScore DPI=72*5; its SVG writer uses that scale.
                                return Number(match[1]) * ({ mm: 1, in: 25.4, pt: 25.4 / 72, px: 25.4 / 360, '': 25.4 / 360 }[match[2] || '']!);
                            };
                            const widthMm = dimension('width'), heightMm = dimension('height');
                            const box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
                            if (root.localName !== 'svg' || doc.querySelector('parsererror') || box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0 || !Number.isFinite(widthMm) || !Number.isFinite(heightMm) || !(widthMm > 0 && heightMm > 0)) {throw new ScoreError('UNSUPPORTED_CAPABILITY', 'renderPage', 'Engine returned invalid SVG');}
                            root.setAttribute('width', `${widthMm}mm`);
                            root.setAttribute('height', `${heightMm}mm`);
                            const svg = new XMLSerializer().serializeToString(doc);
                            const stem = fileStem;
                            const scoreStem = stem(input.name.replace(/\.(mscx|mscz)$/i, ''), 'score');
                            const part = index < 0 ? undefined : parts[index];
                            const pageWarnings = drawn ? drawn.warnings : [{ code: 'SOURCE_COMPLETENESS_UNVERIFIED', message: 'The engine cannot report every font substitution, missing glyph, or imported element loss.' }, { code: 'PART_FIDELITY_UNVERIFIED', message: 'Imported notation and layout fidelity are not established for this file.' }];
                            const target = part ? `part-${String(part.ordinal).padStart(3, '0')}-${stem(part.name, 'part')}` : 'score';
                            return { view: part ? { kind: 'part' as const, partId: part.id } : { kind: 'score' as const }, revision, pageNumber, pageCount, widthMm, heightMm, svg,
                                filename: `${scoreStem}--${target}--page-${String(pageNumber).padStart(4, '0')}.svg`, portability: 'self-contained' as const,
                                warnings: pageWarnings.map(warning => ({ ...warning })) };
                        });
                    },
                    exportMusicXml(operation: Operation & { expectedRevision: number }) {
                        return run('exportMusicXml', operation?.signal, async (): Promise<MusicXmlExport> => {
                            if (!operation || operation.expectedRevision !== revision) {throw new ScoreError('STALE_REVISION', 'exportMusicXml', 'Score revision changed');}
                            const metadata = await call('metadata', [], operation.signal) as Metadata;
                            catalog(metadata);
                            const { xml: musicXml, parts: scoreParts } = await fullScore(operation.signal);
                            // Map each single-instrument catalog part to the full-score part with the same engine identity.
                            const ids = scoreParts.map(part => part.id);
                            const claims = new Map<number, number[]>();
                            musicXmlTargets(metadata, ids).forEach((targets, partIndex) => {
                                if (targets?.length !== 1) {return;}
                                const at = ids.indexOf(targets[0]);
                                claims.set(at, [...(claims.get(at) ?? []), partIndex]);
                            });
                            const result = scoreParts.map((scorePart, at) => {
                                const claim = claims.get(at);
                                const part = claim?.length === 1 ? parts[claim[0]] : undefined;
                                return Object.freeze({ ...scorePart, instrumentNames: Object.freeze([...scorePart.instrumentNames]),
                                    catalogPart: part ? Object.freeze({ id: part.id, name: part.name, origin: part.origin }) : null });
                            });
                            const mapped = result.filter(part => part.catalogPart).length;
                            const partMapping = parts.length && mapped === parts.length && mapped === result.length ? 'complete' : mapped ? 'partial' : 'none';
                            const warnings = [{ code: 'MUSICXML_FIDELITY_UNVERIFIED', message: 'Exported by the MuseScore 4.0 engine (webmscore 1.2.1); equivalence with desktop MuseScore output is not established for this file.' }];
                            if (parts.length && origin === 'existing') {warnings.push({ code: 'MUSICXML_FROM_FULL_SCORE', message: 'The file has saved parts; MusicXML is exported from the full score, so part-only content and part layout are not included.' });}
                            if (parts.length && partMapping !== 'complete') {warnings.push({ code: 'PART_MAPPING_INCOMPLETE', message: 'Some parts could not be matched to exactly one MusicXML part.' });}
                            return Object.freeze({ revision, musicXml, partMapping, parts: Object.freeze(result),
                                filename: `${fileStem(input.name.replace(/\.(mscx|mscz)$/i, ''), 'score')}--score.musicxml`,
                                warnings: Object.freeze(warnings.map(warning => Object.freeze(warning))) });
                        });
                    },
                    hitTest: unsupported('selection.note'),
                    apply: unsupported('edit.pitch'),
                    history: unsupported('history'),
                    undo: unsupported('history'),
                    redo: unsupported('history'),
                    save: unsupported('save.mscz'),
                    dispose() {
                        if (closing) {
                            return closing;
                        }
                        closed = true;
                        closing = (async () => {
                            if (!disposed) {
                                await sessionQueue;
                                await call('destroy');
                            }
                            live = false;
                        })();
                        return closing;
                    }
                });
            } catch (error) {
                live = false;
                throw error;
            }
        },
        async dispose() {
            // Wait for a main-thread operation's committed result before cleanup.
            if (engine) {
                await queue;
            }
            stop();
        }
    };
}
