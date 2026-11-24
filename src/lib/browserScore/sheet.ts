// SPDX-License-Identifier: GPL-3.0-only
// Songbook sheet: one part on an ISO B6 landscape page, laid out like the
// printed carnival booklets (title and song number, a black bar with subtitle
// and composer, the music in a frame, and a footer with instrument, title,
// genre and number). The music is a Verovio SVG nested in the frame.

const SVG = 'http://www.w3.org/2000/svg';
/** ISO B6, landscape. */
export const SHEET = { widthMm: 176, heightMm: 125 } as const;
const MARGIN = 4;
const BAR = { top: 20.5, height: 3.9 };
const FRAME = { top: BAR.top + BAR.height, bottom: 118.8, stroke: 0.3 };
const PADDING = 1.5;
/** Where the music is drawn, in page millimetres. */
export const MUSIC_AREA = {
    x: MARGIN + PADDING, y: FRAME.top + 1.2,
    widthMm: SHEET.widthMm - 2 * (MARGIN + PADDING), heightMm: FRAME.bottom - FRAME.top - 1.2 - PADDING
} as const;

export type SheetHeader = { title: string; subtitle: string; composer: string; genre: string; number: string; instrument: string };
export type SheetFonts = { medium: Uint8Array; bold: Uint8Array };
export const SHEET_FONT = 'Roboto';

function base64(bytes: Uint8Array) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));}
    return btoa(text);
}
const upper = (value: string) => value.toLocaleUpperCase('pt-BR').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\s+/g, ' ').trim();
// Approximate Roboto advance widths, in ems, to keep long text inside its box.
function estimateEm(text: string, bold: boolean) {
    let em = 0;
    for (const char of text) {em += char === ' ' ? 0.25 : /[0-9]/.test(char) ? 0.56 : /[MW]/.test(char) ? 0.88 : /[IJ1]/.test(char) ? 0.3 : /[.,:;!'|]/.test(char) ? 0.25 : /\p{Lu}/u.test(char) ? 0.66 : 0.55;}
    return em * (bold ? 1.04 : 1);
}

/** The music SVG from Verovio, framed into a full songbook sheet. Returns serialized SVG. */
export function composeSheet(musicSvg: string, header: SheetHeader, fonts: SheetFonts): string {
    const music = new DOMParser().parseFromString(musicSvg, 'image/svg+xml');
    const doc = document.implementation.createDocument(SVG, 'svg', null);
    const root = doc.documentElement;
    const { widthMm: W, heightMm: H } = SHEET;
    for (const [name, value] of [['viewBox', `0 0 ${W} ${H}`], ['width', `${W}mm`], ['height', `${H}mm`], ['version', '1.1']]) {root.setAttribute(name, value);}
    const add = (parent: Element, name: string, attributes: Record<string, string | number>, text?: string) => {
        const element = doc.createElementNS(SVG, name);
        for (const [key, value] of Object.entries(attributes)) {element.setAttribute(key, String(value));}
        if (text !== undefined) {element.textContent = text;}
        parent.appendChild(element);
        return element;
    };
    add(root, 'desc', {}, 'Songbook sheet; music engraved by Verovio 6.4.0');
    const defs = add(root, 'defs', {});
    add(defs, 'style', { type: 'text/css' }, ([[500, fonts.medium], [700, fonts.bold]] as const).map(([weight, bytes]) =>
        `@font-face { font-family: '${SHEET_FONT}'; src: url(data:font/woff2;base64,${base64(bytes)}) format('woff2'); font-weight: ${weight}; }`).join('\n'));
    const text = (value: string, x: number, y: number, size: number, weight: 500 | 700, anchor: 'start' | 'middle' | 'end', maxWidth: number, fill = 'black') => {
        const content = upper(value);
        if (!content) {return;}
        const attributes: Record<string, string | number> = { x, y, 'font-family': SHEET_FONT, 'font-weight': weight, 'font-size': size, 'text-anchor': anchor, fill };
        if (estimateEm(content, weight === 700) * size > maxWidth) {Object.assign(attributes, { textLength: maxWidth, lengthAdjust: 'spacingAndGlyphs' });}
        add(root, 'text', attributes, content);
    };
    const inner = W - 2 * MARGIN;
    // Title and song number.
    const number = header.number.trim();
    const numberSize = 12.5;
    const numberWidth = number ? estimateEm(number, true) * numberSize + 4 : 0;
    text(header.title, MARGIN - 0.3, 18.3, 8.2, 700, 'start', inner - numberWidth);
    text(number, W - MARGIN + 0.2, 18.3, numberSize, 700, 'end', numberWidth);
    // Black bar with subtitle (left) and composer (right).
    add(root, 'rect', { x: MARGIN, y: BAR.top, width: inner, height: BAR.height, fill: 'black' });
    const barText = BAR.top + BAR.height / 2 + 1.15;
    const composerWidth = header.composer.trim() ? Math.min(inner * 0.45, estimateEm(upper(header.composer), true) * 3.2) : 0;
    text(header.subtitle, MARGIN + 0.8, barText, 3.2, 700, 'start', inner - 1.6 - composerWidth - (composerWidth ? 3 : 0), 'white');
    text(header.composer, W - MARGIN - 0.8, barText, 3.2, 700, 'end', composerWidth, 'white');
    // Frame around the music.
    add(root, 'rect', { x: MARGIN + FRAME.stroke / 2, y: FRAME.top, width: inner - FRAME.stroke, height: FRAME.bottom - FRAME.top, fill: 'none', stroke: 'black', 'stroke-width': FRAME.stroke });
    // Footer: instrument, title, genre and number.
    const footer = 122.8;
    const third = inner / 3 - 2;
    text(header.instrument, MARGIN, footer, 3, 500, 'start', third);
    text(header.title, W / 2, footer, 3, 500, 'middle', third);
    text([header.genre, number].filter(part => part.trim()).join('  '), W - MARGIN, footer, 3, 500, 'end', third);
    // The music, with fingerings in the sheet's bold sans-serif like the booklets.
    const svg = music.documentElement;
    for (const group of Array.from(svg.querySelectorAll('g.fing, g.dir'))) {
        if (group.classList.contains('dir') && !/^\s*\d+\s*$/.test(group.textContent ?? '')) {continue;}
        for (const element of [group, ...Array.from(group.querySelectorAll('text, tspan'))]) {
            if (element !== group && !element.hasAttribute('font-family') && element.localName !== 'text') {continue;}
            element.setAttribute('font-family', SHEET_FONT);
            element.setAttribute('font-weight', '700');
            if (element.hasAttribute('font-style')) {element.setAttribute('font-style', 'normal');}
        }
    }
    // Jumps and Fine in bold upright serif, volta numbers as bold "1.", like the booklets.
    for (const group of Array.from(svg.querySelectorAll('g.dir'))) {
        if (!/D\.\s?[CS]\.|\b(Fine|Coda|Segno)\b/i.test(group.textContent ?? '')) {continue;}
        for (const element of Array.from(group.querySelectorAll('text, tspan[font-style]'))) { element.setAttribute('font-style', 'normal'); element.setAttribute('font-weight', 'bold'); }
    }
    for (const label of Array.from(svg.querySelectorAll('g.voltaBracket > text'))) {
        label.setAttribute('font-weight', 'bold');
        const leaf = Array.from(label.querySelectorAll('tspan')).find(tspan => !tspan.children.length && /^\s*\d+(,\s*\d+)*\s*$/.test(tspan.textContent ?? ''));
        if (leaf) {leaf.textContent = leaf.textContent!.trim() + '.';}
    }
    const nested = doc.importNode(svg, true) as Element;
    for (const [name, value] of [['x', MUSIC_AREA.x], ['y', MUSIC_AREA.y], ['width', MUSIC_AREA.widthMm], ['height', MUSIC_AREA.heightMm]] as const) {nested.setAttribute(name, String(value));}
    nested.removeAttribute('version');
    root.appendChild(nested);
    return new XMLSerializer().serializeToString(doc);
}
