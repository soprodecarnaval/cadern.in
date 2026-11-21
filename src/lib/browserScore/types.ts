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
export type MusicXmlExport = {
    revision: Revision; filename: string; musicXml: string; parts: readonly MusicXmlPart[];
    partMapping: 'complete' | 'partial' | 'none'; warnings: readonly Warning[];
};
export type SvgPage = { view: View; revision: Revision; pageNumber: number; pageCount: number; widthMm: number; heightMm: number; svg: string; filename: string; warnings: readonly Warning[]; portability: 'self-contained' };
export const capabilities = [
    'import.mscx', 'import.mscz', 'parts.enumerate', 'parts.generateIfAbsent',
    'svg.page', 'export.musicxml', 'selection.note', 'edit.pitch', 'edit.rhythm', 'edit.pageLayout',
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
export interface ScoreLibrary {
    open(input: { bytes: Uint8Array; format: Format; name: string },
         options?: Operation & { compatibility?: 'strict' | 'allowUnverified'; songbook?: SongbookInfo }): Promise<ScoreSession>;
    dispose(): Promise<void>;
}
