// SPDX-License-Identifier: GPL-3.0-only
/** `Object.hasOwn` for the ES2020 target. */
export const hasOwn = (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key);
export class ScoreError extends Error {
    readonly name = 'ScoreError';
    constructor(
        public readonly code: string,
        public readonly operation: string,
        message: string,
        public readonly sessionInvalidated = false,
        public readonly capability?: string
    ) {
        super(message);
    }
}
export type Format = 'mscx' | 'mscz';
export type Warning = { code: string; message: string };
export type Limits = { inputBytes: number; expandedBytes: number; archiveEntries: number; operationMs: number };
export type Operation = { signal?: AbortSignal };
export type PartId = string;
export type Revision = number;
/**
 * One instrument of a part, as the MSCX writes it: MuseScore's instrument id (`<Instrument id>`,
 * e.g. `bb-tuba-treble`), the MusicXML sound id (`<instrumentId>`, e.g. `brass.tuba`) and the names.
 */
export type PartInstrument = { id: string; soundId: string | null; longName: string; shortName: string };
export type Part = {
    id: PartId; name: string; ordinal: number; origin: 'existing' | 'generated'; instrumentNames: readonly string[]; staffCount: number | null;
    /** The part's instruments, read from the MSCX; empty when they could not be matched. */
    instruments: readonly PartInstrument[];
    /** `instruments[].id`, or the sound id when an instrument has no MuseScore id. */
    instrumentIds: readonly string[];
};
export type PartCatalog = { revision: Revision; parts: readonly Part[]; coverage: 'complete' | 'incomplete' | 'unknown'; warnings: readonly Warning[] };
export type View = { kind: 'score' } | { kind: 'part'; partId: PartId };
export type PageSet = { revision: Revision; pageCount: number };
/** One instrument part of the full-score MusicXML, with the catalog part it corresponds to when known. */
export type MusicXmlPart = {
    id: string; name: string; instrumentNames: readonly string[];
    /** Semitones from written to sounding pitch (MusicXML chromatic + 12 × octave-change); null when untransposed. */
    transposeChromatic: number | null;
    catalogPart: { id: PartId; name: string; origin: Part['origin'] } | null;
};
export type MidiExport = { view: View; revision: Revision; midi: Uint8Array; filename: string; warnings: readonly Warning[] };
export type MusicXmlExport = {
    revision: Revision; filename: string; musicXml: string; parts: readonly MusicXmlPart[];
    partMapping: 'complete' | 'partial' | 'none'; warnings: readonly Warning[];
};
/** How a 'songbook' or 'fitted' part was laid out. `fillRatio` is the height the music needs over the box height. */
export type SheetLayoutResult = { staffSpaceMm: number; systems: number; fillRatio: number; fingeringScale: number };
export type SvgPage = { view: View; revision: Revision; pageNumber: number; pageCount: number; widthMm: number; heightMm: number; svg: string; filename: string; warnings: readonly Warning[];
    /** 'shared-fonts': the text fonts are the manifest's textFonts files, not in the SVG. */
    portability: 'self-contained' | 'shared-fonts';
    /** Present on 'songbook' and 'fitted' pages. */
    layout?: SheetLayoutResult };
/**
 * Layout a host fixes for one 'songbook' or 'fitted' part instead of searching it: the staff space
 * in mm (otherwise the largest that fits one page), the number of systems (otherwise balanced) and
 * Verovio's spacing (`spacingLinear`, `spacingNonLinear`, `spacingSystem`) and fingering size.
 */
export type SheetLayout = { staffSpaceMm?: number; systems?: number; spacingLinear?: number; spacingNonLinear?: number; spacingSystem?: number;
    /** Verovio fingeringScale: fingering text size relative to the staff (default 0.9). */
    fingeringScale?: number };
export const capabilities = [
    'import.mscx', 'import.mscz', 'parts.enumerate', 'parts.generateIfAbsent',
    'svg.page', 'export.musicxml', 'export.midi', 'selection.note', 'edit.pitch', 'edit.rhythm', 'edit.pageLayout',
    'history', 'save.mscx', 'save.mscz'
] as const;
export type Capability = typeof capabilities[number];
export type Support = { available: boolean; reason?: string };
export type LibraryOptions = Operation & {
    adapter: 'webmscore-1.2.1';
    assets: { manifestUrl: URL; workerUrl: URL };
    execution: 'worker' | 'main-thread';
    fonts?: readonly { name: string; bytes: Uint8Array }[];
    limits?: Partial<Limits>;
    /**
     * Part page style.
     * - 'songbook' (default): one sheet per part on ISO B6 landscape (176 × 125 mm) with the
     *   booklet header and footer, the staff sized to fit one page.
     * - 'fitted': the music only, fitted to `fitArea` at the largest staff size that keeps the
     *   part on one page, with systems balanced. For hosts that draw their own header and footer.
     * - 'plain': renderer pages sized by `partPageSize`.
     */
    partPageStyle?: PartPageStyle;
    /**
     * Text fonts of 'fitted' and 'plain' part pages. 'embedded' (default): each SVG carries its fonts
     * as data URIs. 'shared': the SVG only names the families; the fonts are the manifest's
     * `textFonts` files, which hosts load once (the reader injects them, the songbook PDF registers them).
     */
    textFonts?: 'embedded' | 'shared';
    /**
     * Paper for 'plain' part pages: ISO B6 portrait, 125 × 176 mm (default), the score's own
     * page layout, or a custom size. A custom size without margins keeps the score's margins,
     * scaled to the new page width.
     */
    partPageSize?: 'B6' | 'score' | PageSize;
    /** Box the music is fitted to for 'fitted' pages; defaults to the songbook sheet's music area. */
    fitArea?: AreaSize;
};
export type PartPageStyle = 'songbook' | 'fitted' | 'plain';
export type AreaSize = { widthMm: number; heightMm: number };
/** Margins are [top, right, bottom, left], in millimetres. */
export type PageSize = AreaSize & { marginsMm?: readonly [number, number, number, number] };
/**
 * Songbook sheet header. Fields left out come from the score: title from the
 * `workTitle` meta tag, the MusicXML title or the score file name; subtitle from
 * `subtitle` or `source`; composer from `composer`; genre from `lyricist` (the
 * booklet convention). The song number is not stored in scores.
 */
export type SongbookInfo = { title?: string; subtitle?: string; composer?: string; genre?: string; number?: string };
export interface ScoreSession {
    readonly id: string;
    readonly capabilities: Readonly<Record<Capability, Support>>;
    readonly importInfo: {
        inputFormat: Format; fileVersion: string; compatibility: 'unverified';
        warnings: readonly Warning[];
        /** The score's meta tags (workTitle, composer, source, ...) as written in the file. */
        metaTags: Readonly<Record<string, string>>;
    };
    listParts(options?: Operation): Promise<PartCatalog>;
    prepareParts(options: Operation & { policy: 'preserveExistingOrGenerateIfNone'; expectedRevision: Revision }): Promise<PartCatalog>;
    getPages(view: View, options?: Operation): Promise<PageSet>;
    renderPage(view: View, pageNumber: number, options: Operation & { expectedRevision: Revision; background?: 'transparent' | 'white' }): Promise<SvgPage>;
    /**
     * Standard MIDI file of the full score or one part, from the engine (repeats expanded, RPNs
     * written, as desktop MuseScore exports). Parts are the engine's excerpts: saved parts as
     * saved, generated parts after prepareParts.
     */
    exportMidi(view: View, options: Operation & { expectedRevision: Revision }): Promise<MidiExport>;
    /**
     * Forget the drawn pages of one part (or of every part), so the next getPages/renderPage draws
     * them again: for hosts whose partTransform or partLayout output changed.
     */
    invalidate(view?: View): void;
    /** Full-score MusicXML (partwise, uncompressed) with every instrument part. */
    exportMusicXml(options: Operation & { expectedRevision: Revision }): Promise<MusicXmlExport>;
    hitTest(...args: unknown[]): Promise<never>;
    apply(...args: unknown[]): Promise<never>;
    history(options?: Operation): Promise<never>;
    undo(...args: unknown[]): Promise<never>;
    redo(...args: unknown[]): Promise<never>;
    save(...args: unknown[]): Promise<never>;
    dispose(): Promise<void>;
}
/**
 * A host transform of one part's MusicXML, run after the part is extracted from the full score and
 * before it is drawn (clean-up, fingerings, notation changes). `musicXmlPartIds` are the full-score
 * MusicXML part ids it contains. Must be deterministic: its output is cached per part and revision.
 */
export type PartTransform = (input: { musicXml: string; part: Part; musicXmlPartIds: readonly string[] }) =>
    { musicXml: string; warnings?: readonly Warning[] };
/** What draws the pages: this library's layout version, the engine and renderer, and the asset digests. */
export type RendererInfo = { library: string; engine: string; renderer: string; manifestSha256: string; fonts: readonly { path: string; sha256: string }[] };
export interface ScoreLibrary {
    readonly renderer: RendererInfo;
    open(input: { bytes: Uint8Array; format: Format; name: string },
         options?: Operation & { compatibility?: 'strict' | 'allowUnverified'; songbook?: SongbookInfo; partTransform?: PartTransform;
                   /** Layout per part for 'songbook' and 'fitted' pages. Must be deterministic, like partTransform. */
                   partLayout?: (part: Part) => SheetLayout | undefined }): Promise<ScoreSession>;
    dispose(): Promise<void>;
}
