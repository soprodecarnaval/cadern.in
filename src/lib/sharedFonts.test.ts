import { describe, expect, it } from "vitest";
import { withoutEmbeddedFonts } from "./browserScore/index";
import { fontFaceCss, needsTextFonts, pdfFontName, textFontCallback, withTextFonts } from "./sharedFonts";

const embedded = '<svg viewBox="0 0 1 1"><style type="text/css">@font-face {\n font-family: "Liberation";\n src: url(data:font/woff2;base64,AAAA) format(woff2);\n}\n@font-face { font-family: "Liberation"; src: url(data:font/woff2;base64,BBBB) format(woff2); font-weight: bold; }</style><text font-family="Liberation">1</text></svg>';

const families = new Set(["Liberation"]);

describe("shared text fonts", () => {
  it("strips the renderer's embedded fonts but keeps the families", () => {
    const shared = withoutEmbeddedFonts(embedded, families);
    expect(shared).toBe('<svg viewBox="0 0 1 1"><text font-family="Liberation">1</text></svg>');
    expect(withoutEmbeddedFonts('<svg><style>.a{fill:red}</style></svg>', families)).toBe('<svg><style>.a{fill:red}</style></svg>');
    // Verovio's own Leipzig subset (chord-symbol glyphs) stays.
    const leipzig = "@font-face { font-family: 'Leipzig'; src: url(data:font/woff2;base64,CCCC) format(woff2); }";
    expect(withoutEmbeddedFonts(embedded.replace('</style>', `${leipzig}</style>`), families)).toContain(leipzig);
  });

  it("embeds them again for display, only where needed", () => {
    const shared = withoutEmbeddedFonts(embedded, families);
    expect(needsTextFonts(shared, ["Liberation"])).toBe(true);
    expect(needsTextFonts(embedded, ["Liberation"])).toBe(false);
    expect(needsTextFonts('<svg><path d="M0 0"/></svg>', ["Liberation"])).toBe(false);
    expect(needsTextFonts(`<svg><style>@font-face { font-family: 'Leipzig'; src: url(x); }</style><text font-family="Liberation">1</text></svg>`, ["Liberation"])).toBe(true);
    const css = fontFaceCss([{ font: { family: "Liberation", weight: "bold", style: "italic", path: "fonts/x.woff2", sha256: "" }, bytes: new Uint8Array([1, 2, 3]) }]);
    expect(css).toBe('@font-face{font-family:"Liberation";src:url(data:font/woff2;base64,AQID) format("woff2");font-weight:bold;font-style:italic}');
    expect(withTextFonts(shared, css)).toBe(`<svg viewBox="0 0 1 1"><style type="text/css">${css}</style><text font-family="Liberation">1</text></svg>`);
  });

  it("names and finds the fonts in the PDF, with standard fallbacks", () => {
    expect(pdfFontName({ family: "Liberation", weight: "bold", style: "normal" })).toBe("Liberation-Bold");
    const callback = textFontCallback(new Set(["Liberation", "Liberation-Bold", "Liberation-Italic", "Liberation-BoldItalic"]));
    expect(callback("Liberation, serif", false, false)).toBe("Liberation");
    expect(callback("Liberation", true, true)).toBe("Liberation-BoldItalic");
    expect(callback("Arial, sans-serif", true, false)).toBe("Helvetica-Bold");
    expect(textFontCallback(new Set())("Liberation", false, true)).toBe("Times-Italic");
  });
});
