// The text fonts library-rendered pages name but don't embed (ticket 014):
// the manifest's `textFonts`, served with the engine assets. The reader and
// the send screen's previews inject them into each SVG before showing it as
// an image (an <img> SVG can't load outside fonts); the songbook PDF
// registers them with PDFKit.

export type TextFont = {
  family: string; weight: string; style: string;
  /** WOFF2, for display. */
  path: string; sha256: string;
  /** TTF copy, for the PDF: PDFKit draws WOFF2 glyphs wrongly. */
  ttfPath?: string;
};
export type TextFontFormat = "woff2" | "ttf";

const MANIFEST = "/browser-score/manifest.json";

const fonts = new Map<TextFontFormat, Promise<{ font: TextFont; bytes: Uint8Array }[]>>();

/** The shared text fonts and their bytes, fetched once per page load: WOFF2 for display, TTF for the PDF. */
export function loadTextFonts(format: TextFontFormat = "woff2", fetcher: typeof fetch = fetch): Promise<{ font: TextFont; bytes: Uint8Array }[]> {
  const cached = fonts.get(format);
  if (cached) {return cached;}
  const loading = (async () => {
    const manifest = (await (await fetcher(MANIFEST)).json()) as { textFonts?: TextFont[] };
    return Promise.all(
      (manifest.textFonts ?? []).map(async (font) => {
        const path = format === "ttf" ? font.ttfPath : font.path;
        if (!path) {throw new Error(`No ${format} file for ${font.family}`);}
        const response = await fetcher(new URL(path, new URL(MANIFEST, window.location.origin)).href);
        if (!response.ok) {throw new Error(`Font unavailable: ${font.path}`);}
        return { font, bytes: new Uint8Array(await response.arrayBuffer()) };
      }),
    );
  })();
  fonts.set(format, loading);
  loading.catch(() => fonts.delete(format));
  return loading;
}

const base64 = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));}
  return btoa(text);
};

/** @font-face rules with the fonts as data URIs, for SVGs shown as images. */
export function fontFaceCss(loaded: readonly { font: TextFont; bytes: Uint8Array }[]): string {
  return loaded
    .map(({ font, bytes }) =>
      `@font-face{font-family:"${font.family}";src:url(data:font/woff2;base64,${base64(bytes)}) format("woff2");` +
      `font-weight:${font.weight};font-style:${font.style}}`,
    )
    .join("");
}

/** Whether an SVG names one of the shared families without embedding it. */
export const needsTextFonts = (svg: string, families: readonly string[]) =>
  families.some(
    (family) =>
      svg.includes(`font-family="${family}`) &&
      !new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*["']?${family}["']?\\s*;`).test(svg),
  );

/** The SVG with the shared fonts embedded again, right after the root element opens. */
export function withTextFonts(svg: string, css: string): string {
  return svg.replace(/<svg\b[^>]*>/, (open) => `${open}<style type="text/css">${css}</style>`);
}

/** PDFKit font names for the shared fonts: Family, Family-Bold, Family-Italic, Family-BoldItalic. */
export const pdfFontName = (font: Pick<TextFont, "family" | "weight" | "style">) =>
  font.family + (font.weight === "bold" && font.style === "italic" ? "-BoldItalic" : font.weight === "bold" ? "-Bold" : font.style === "italic" ? "-Italic" : "");

/**
 * svg-to-pdfkit font lookup that also understands family lists
 * ("Liberation, serif"): the first family, when registered, in the right
 * weight and style; otherwise the PDF standard fonts, as svg-to-pdfkit does.
 */
export const textFontCallback = (registered: ReadonlySet<string>) =>
  (family: string, bold: boolean, italic: boolean): string => {
    const first = family.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const variant = first + (bold && italic ? "-BoldItalic" : bold ? "-Bold" : italic ? "-Italic" : "");
    if (registered.has(variant)) {return variant;}
    if (registered.has(first)) {return first;}
    if (/(?:^|,)\s*monospace\s*$/.test(family)) {return bold && italic ? "Courier-BoldOblique" : bold ? "Courier-Bold" : italic ? "Courier-Oblique" : "Courier";}
    // Liberation Serif has Times' metrics, so it falls back to Times too.
    if (/(?:^|,)\s*serif\s*$/.test(family) || first === "Liberation") {
      return bold && italic ? "Times-BoldItalic" : bold ? "Times-Bold" : italic ? "Times-Italic" : "Times-Roman";
    }
    return bold && italic ? "Helvetica-BoldOblique" : bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica";
  };
