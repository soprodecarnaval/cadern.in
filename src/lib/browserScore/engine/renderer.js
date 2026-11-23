// SPDX-License-Identifier: GPL-3.0-only
// Part renderer: draws MusicXML as SVG pages with Verovio (LGPL-3.0-only, an
// unmodified upstream module loaded at run time). Runs in the engine worker or
// on the main thread. Only page geometry is accepted from callers; every other
// Verovio option is fixed here.
let toolkit;

async function load() {
    if (!toolkit) {
        const [{ default: createModule }, { VerovioToolkit, enableLog, LOG_ERROR }] = await Promise.all([
            import('./verovio/verovio-module.mjs'), import('./verovio/verovio.mjs')]);
        const module = await createModule();
        // Compressed-justification notices are expected while fitting a sheet.
        enableLog(LOG_ERROR, module);
        toolkit = new VerovioToolkit(module);
    }
    return toolkit;
}

const range = (value, low, high, fallback) => Number.isFinite(value) && value >= low && value <= high ? value : fallback;
// Verovio page units are tenths of a millimetre.
const tenths = mm => Math.round(mm * 10);
// Verovio draws structural milestones (sections, page breaks) as small ellipses; they are not notation.
const withoutPlaceholders = svg => svg.replace(/(<g\b[^>]*\bclass="[^"]*\bplaceholder\b[^"]*"[^>]*>)\s*<ellipse\b[^>]*\/>/g, '$1');
const systems = svg => (svg.match(/class="system"/g) || []).length;

/**
 * @param {string} musicXml MusicXML containing only the parts to draw.
 * @param {{ widthMm: number, heightMm: number, marginsMm: number[], staffSpaceMm: number }} page
 * @returns {Promise<{ pages: string[] } | { error: 'load' }>}
 */
export async function renderMusicXml(musicXml, page) {
    const tk = await load();
    const [top, right, bottom, left] = page.marginsMm.map(mm => range(mm, 0, 100, 10));
    tk.resetOptions();
    tk.setOptions({
        pageWidth: tenths(page.widthMm), pageHeight: tenths(page.heightMm),
        pageMarginTop: tenths(top), pageMarginRight: tenths(right), pageMarginBottom: tenths(bottom), pageMarginLeft: tenths(left),
        // `unit` is half a staff space in tenths of a millimetre.
        unit: range(page.staffSpaceMm * 5, 4.5, 12, 9), scale: 100, adjustPageHeight: false,
        breaks: 'auto', header: 'auto', footer: 'none', svgViewBox: true, mmOutput: true,
        fontTextLiberation: true, svgRemoveXlink: false, xmlIdSeed: 1
    });
    if (!tk.loadData(musicXml)) return { error: 'load' };
    const count = tk.getPageCount();
    const pages = [];
    for (let n = 1; n <= count; n++) pages.push(withoutPlaceholders(tk.renderToSVG(n, false)));
    return { pages };
}

// Fingering heights, as the caderninhoFormatter plugin sets them (in staff spaces above the
// note): 1, plus 2.3 for each further note of a chord, plus up to PITCH_RISE for the highest notes
// of the page, so the numbers follow the melody up and down.
const FINGERING_GAP = 0.6, CHORD_STEP = 2.3;
// Staff spaces reserved above every system of a part with fingerings: the band the numbers float
// in, from just above the top line (lowest notes) to FINGERING_ROOM higher (highest notes).
export const FINGERING_ROOM = 2;
// Verovio 6.4 rejects fingeringScale above 1 and uses its default of 0.75.
const VEROVIO_FINGERING_MAX = 1;

/**
 * Moves each fingering of a drawn page from Verovio's common row into a band above the staff: never
 * inside the staff, higher for higher notes, as the plugin did, so the numbers trace the melody; and
 * always above its own note (the top of its chord, its articulations) when that is above the staff.
 * The band is the FINGERING_ROOM renderSheet reserves above each system, so the page fit holds.
 * Text-only: the worker has no DOM.
 * @param {string} svg a Verovio page, rendered with svgAdditionalAttribute fing@startid.
 * @param {number} unit the page's unit (half a staff space, tenths of a millimetre).
 * @param {number} [fontMultiplier] extra scaling beyond Verovio's supported range.
 */
export function withNoteHeightFingerings(svg, unit, fontMultiplier = 1) {
    if (!svg.includes('class="fing"')) return svg;
    if (fontMultiplier > 1) {
        svg = svg.replace(/<g\b[^>]*\bclass="fing"[^>]*>\s*<text\b[^>]*>[\s\S]*?<\/text>/g, text =>
            text.replace(/(<tspan\b[^>]*\bfont-size=")([\d.]+)px"/g, (_, head, size) =>
                head + Math.round(Number(size) * fontMultiplier) + 'px"'));
    }
    const space = unit * 20; // staff space in the page's definition units (0.01 mm)
    // Noteheads, in document order, with the top line of the staff they belong to.
    const notes = new Map(), byStaff = [];
    let staffTop = null, staffIndex = -1, pendingStaff = false;
    const token = /class="staff"|<path d="M[\d.]+ ([\d.]+) L[\d.]+ \1"|<g id="([^"]+)" class="note"[^>]*>\s*<g class="notehead">\s*<use [^>]*transform="translate\(([\d.]+), ([\d.]+)\)/g;
    for (const match of svg.matchAll(token)) {
        if (match[0] === 'class="staff"') { pendingStaff = true; staffIndex++; byStaff[staffIndex] = []; continue; }
        if (match[1] !== undefined) { if (pendingStaff) { staffTop = Number(match[1]); pendingStaff = false; } continue; }
        if (staffTop === null || staffIndex < 0) continue;
        const note = { id: match[2], x: Number(match[3]), y: Number(match[4]), staffTop, staff: staffIndex };
        notes.set(note.id, note);
        byStaff[staffIndex].push(note);
    }
    // The chord of a note: noteheads of the same staff at (about) the same x.
    const chordOf = note => byStaff[note.staff].filter(other => Math.abs(other.x - note.x) <= space * 1.2);
    const anchors = new Map();
    for (const match of svg.matchAll(/class="fing"[^>]*data-startid="#([^"]+)"/g)) {
        const note = notes.get(match[1]);
        if (!note) continue;
        const chord = chordOf(note);
        const top = chord.reduce((high, other) => (other.y < high.y ? other : high), note);
        anchors.set(match[1], { x: note.x, y: top.y, staffTop: top.staffTop, relative: top.y - top.staffTop, count: chord.length });
    }
    if (!anchors.size) return svg;
    // Articulations (staccato dots, accents) above a note: the number goes above them.
    const articulations = [...svg.matchAll(/class="artic"[^>]*>\s*(?:<[^>]*>\s*)*?<use [^>]*transform="translate\(([\d.]+), ([\d.]+)\)/g)]
        .map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
    const relatives = [...anchors.values()].map(anchor => anchor.relative);
    const lowest = Math.max(...relatives), highest = Math.min(...relatives);
    // Volta brackets: numbers under one stay below its hooks and its ending number.
    const brackets = [...svg.matchAll(/class="ending[^"]*"[^>]*>[\s\S]*?<\/g>/g)].flatMap(group => {
        const line = /<path d="M([\d.]+) ([\d.]+) L([\d.]+) \2"/.exec(group[0]);
        if (!line) return [];
        const ys = [...group[0].matchAll(/<path d="M[\d.]+ ([\d.]+) L[\d.]+ ([\d.]+)"/g), ...group[0].matchAll(/<text [^>]*\by="([\d.]+)"/g)]
            .flatMap(m => m.slice(1).filter(Boolean).map(Number));
        return [{ from: Number(line[1]), to: Number(line[3]), y: Math.max(...ys) }];
    });
    return svg.replace(/(<g [^>]*class="fing"[^>]*data-startid="#([^"]+)"[^>]*>\s*<text [^>]*?\by=")([\d.]+)("[\s\S]*?<tspan font-size="([1-9][\d.]*)px")/g, (whole, head, id, y, tail, fontSize) => {
        const anchor = anchors.get(id);
        if (!anchor) return whole;
        const rise = lowest > highest ? (lowest - anchor.relative) / (lowest - highest) : 1;
        // Above the notehead (half a space above its centre), then the plugin's offsets.
        const above = articulations
            .filter(artic => Math.abs(artic.x - anchor.x) <= space && artic.y < anchor.y && artic.y > anchor.y - space * 3)
            .reduce((top, artic) => Math.min(top, artic.y - space * 0.6), anchor.y);
        // In the band above the staff, by pitch; and clear of the note itself when it is higher.
        const band = anchor.staffTop - space * (FINGERING_GAP + rise * FINGERING_ROOM);
        const overNote = Math.min(above, anchor.y) - space * (0.5 + FINGERING_GAP + (anchor.count - 1) * CHORD_STEP);
        let wanted = Math.min(band, overNote);
        // Below a volta bracket over the note (a digit is about 0.72 of the font size tall).
        const bottom = anchor.staffTop - space * FINGERING_GAP;
        for (const bracket of brackets) {
            if (anchor.x < bracket.from || anchor.x > bracket.to || bracket.y > bottom) continue;
            wanted = Math.min(bottom, Math.max(wanted, bracket.y + Number(fontSize) * 0.72 + space * 0.3));
        }
        // Never higher than the room reserved above Verovio's own row.
        return head + Math.round(Math.max(Number(y) - space * FINGERING_ROOM, wanted)) + tail;
    });
}

/** Measure indexes that start each of `count` systems, balancing the summed widths (widest system minimal). */
function balancedStarts(widths, count) {
    const total = [0];
    for (const width of widths) total.push(total[total.length - 1] + width);
    const m = widths.length;
    const cost = [Array(m + 1).fill(Infinity)], from = [Array(m + 1).fill(-1)];
    cost[0][0] = 0;
    for (let k = 1; k <= count; k++) {
        cost.push(Array(m + 1).fill(Infinity)); from.push(Array(m + 1).fill(-1));
        for (let j = k; j <= m; j++) for (let i = k - 1; i < j; i++) {
            const value = Math.max(cost[k - 1][i], total[j] - total[i]);
            if (value < cost[k][j]) { cost[k][j] = value; from[k][j] = i; }
        }
    }
    const starts = [];
    for (let k = count, j = m; k > 0; k--) { j = from[k][j]; starts.unshift(j); }
    return starts;
}

/**
 * Measures grouped as the page draws them: a multi-measure rest (<multiple-rest>N on its first
 * measure) is one short block that a system break never splits; every other measure is its own block.
 * @returns {{ first: number, width: number }[]}
 */
function measureBlocks(musicXml, widths) {
    const runs = new Map();
    let index = -1;
    for (const match of musicXml.matchAll(/<measure\b[^>]*>|<multiple-rest>(\d+)<\/multiple-rest>/g)) {
        if (match[1] === undefined) index++;
        else runs.set(index, Number(match[1]));
    }
    const blocks = [];
    for (let i = 0; i < widths.length;) {
        const count = Math.max(1, Math.min(runs.get(i) ?? 1, widths.length - i));
        // A multi-measure rest is about as wide as a measure with one rest and its count.
        blocks.push({ first: i, width: count > 1 ? 4 : widths[i] });
        i += count;
    }
    return blocks;
}

// A system break before each listed measure. The caller has removed every <print> element.
function withBreaks(musicXml, starts) {
    const breaks = new Set(starts.filter(index => index > 0));
    let index = -1;
    return musicXml.replace(/<measure\b[^>]*>/g, tag => (++index, breaks.has(index) ? tag + '<print new-system="yes"/>' : tag));
}

// Staff sizes tried for a songbook sheet, largest first (half a staff space, tenths of a millimetre),
// in steps of 0.05 mm of staff space.
const SHEET_UNITS = Array.from({ length: 23 }, (_, i) => 10.5 - i * 0.25);
// Horizontal spacing calibrated on the 2026 caderninhos: at these values the staff size matches what
// the caderninhoFormatter plugin chose in MuseScore (median within 2% on parts without fingerings).
const SHEET_SPACING = { spacingLinear: 0.21, spacingNonLinear: 0.6, spacingSystem: 4 };
// Tried, in order, when a part fits one page at no staff size with its own spacing.
const TIGHTER_SPACING = [{ spacingLinear: 0.15, spacingNonLinear: 0.55 }, { spacingLinear: 0.1, spacingNonLinear: 0.5 }];

/**
 * Draw one part as a songbook sheet: the music only, sized to fit `area` on a
 * single page when possible, at the largest staff size, with systems balanced.
 * `layout` fixes what the caller does not want searched: the staff size
 * (`unit`), the number of systems, and Verovio's horizontal and system spacing.
 * When the part does not fit one page, the best attempt (smallest staff, or the
 * fixed one) is returned on more pages; music is never cut off.
 * @param {string} musicXml single-part MusicXML without <print> elements.
 * @param {{ widthMm: number, heightMm: number }} area
 * @param {number[]} widths relative content width of each measure, in order.
 * @param {{ unit?: number, systems?: number, spacingLinear?: number, spacingNonLinear?: number, spacingSystem?: number, fingeringScale?: number }} [layout]
 * @returns {Promise<{ pages: string[], staffSpaceMm: number, systems: number, contentHeightMm: number } | { error: 'load' }>}
 */
export async function renderSheet(musicXml, area, widths, layout = {}) {
    const tk = await load();
    // Balancing works on blocks: a multi-measure rest is one, never split by a system break.
    const blocks = measureBlocks(musicXml, widths);
    const measures = blocks.length;
    const startsFor = count => balancedStarts(blocks.map(block => block.width), Math.min(count, measures)).map(index => blocks[index].first);
    const spacing = {
        spacingLinear: range(layout.spacingLinear, 0, 1, SHEET_SPACING.spacingLinear),
        spacingNonLinear: range(layout.spacingNonLinear, 0, 1, SHEET_SPACING.spacingNonLinear),
        spacingSystem: range(layout.spacingSystem, 0, 12, SHEET_SPACING.spacingSystem),
        fingeringScale: range(layout.fingeringScale, 0.3, 2, 0.9)
    };
    // When nothing fits, smaller fingerings are tried, as the plugin shrinks the fingering font down
    // to 7 pt; a fingering scale the caller fixed is kept.
    const fingeringScales = Number.isFinite(layout.fingeringScale) ? [spacing.fingeringScale] : [0.9, 0.75, 0.6];
    // Parts with fingerings get FINGERING_ROOM above each system for the numbers (and above the first).
    const fingered = musicXml.includes('<fingering');
    const fontMultiplier = () => Math.max(1, spacing.fingeringScale / VEROVIO_FINGERING_MAX);
    // At scale 1 the digits are about 1.6 staff spaces tall. Reserve room for the extra height.
    const fingeringRoom = () => fingered ? FINGERING_ROOM + 1.7 * (fontMultiplier() - 1) : 0;
    const options = (unit, starts, natural) => ({
        pageWidth: tenths(area.widthMm), pageHeight: tenths(area.heightMm),
        // Room on the left for measure numbers at the start of a system.
        pageMarginTop: Math.round(fingeringRoom() * 2 * unit), pageMarginRight: 0, pageMarginBottom: 0, pageMarginLeft: 15,
        unit, scale: 100, adjustPageHeight: natural, justifyVertically: !natural, minLastJustification: 0,
        breaks: starts ? 'line' : 'auto', header: 'none', footer: 'none',
        ...spacing,
        fingeringScale: Math.min(spacing.fingeringScale, VEROVIO_FINGERING_MAX),
        spacingSystem: spacing.spacingSystem + fingeringRoom(),
        svgViewBox: true, mmOutput: true, fontTextLiberation: true, svgRemoveXlink: false, xmlIdSeed: 1,
        // Links each fingering to its note, for withNoteHeightFingerings.
        svgAdditionalAttribute: ['fing@startid']
    });
    let current = null;
    const draw = (unit, starts) => {
        tk.resetOptions();
        tk.setOptions(options(unit, starts, false));
        if (!tk.loadData(starts ? withBreaks(musicXml, starts) : musicXml)) return null;
        current = { unit, starts };
        return tk.getPageCount();
    };
    const result = () => {
        const pages = [];
        for (let n = 1; n <= tk.getPageCount(); n++) pages.push(withNoteHeightFingerings(withoutPlaceholders(tk.renderToSVG(n, false)), current.unit, fontMultiplier()));
        const { unit, starts } = current;
        const count = pages.reduce((sum, page) => sum + systems(page), 0);
        // Height the music needs, for the fill ratio: the lowest horizontal line (staff or ledger
        // line) with the systems packed at the top (no vertical justification), in the
        // definition-scale units of the page.
        let contentHeightMm = area.heightMm * pages.length;
        if (pages.length === 1) {
            tk.setOptions({ justifyVertically: false });
            tk.loadData(starts ? withBreaks(musicXml, starts) : musicXml);
            const packed = tk.renderToSVG(1, false);
            const scale = /class="definition-scale"[^>]*viewBox="([^"]*)"/.exec(packed);
            const unitsHigh = scale ? Number(scale[1].trim().split(/[\s,]+/)[3]) : NaN;
            let lowest = 0;
            for (const match of packed.matchAll(/<path d="M[\d.]+ ([\d.]+) L[\d.]+ \1"[^>]*stroke-width/g)) {lowest = Math.max(lowest, Number(match[1]));}
            if (unitsHigh > 0 && lowest > 0) {contentHeightMm = lowest / unitsHigh * area.heightMm;}
        }
        return { pages, staffSpaceMm: unit / 5, systems: count, contentHeightMm, fingeringScale: spacing.fingeringScale };
    };
    const fixedSystems = Number.isInteger(layout.systems) && layout.systems > 0 ? Math.min(layout.systems, measures) : null;
    const fit = unit => {
        const count = draw(unit, null);
        if (count === null) return { error: 'load' };
        if (fixedSystems) return draw(unit, startsFor(fixedSystems)) === 1 ? 'fits' : 'overflow';
        if (count !== 1) return 'overflow';
        // As in MuseScore, the spacing decides how many systems there are; the largest staff that
        // keeps them on one page wins. The measures are then balanced over those systems.
        const auto = systems(tk.renderToSVG(1, false));
        if (draw(unit, startsFor(auto)) === 1) return 'fits';
        draw(unit, null);
        return 'fits';
    };
    const fixedUnit = Number.isFinite(layout.unit) ? range(layout.unit, 4, 12, SHEET_UNITS[0]) : null;
    // Dense parts that fit no staff size get tighter horizontal spacing (fewer, fuller systems)
    // before smaller fingerings; the plugin's MuseScore spacing was tighter for such music.
    const given = { spacingLinear: spacing.spacingLinear, spacingNonLinear: spacing.spacingNonLinear };
    const spacings = [given, ...TIGHTER_SPACING.filter(tight => tight.spacingLinear < given.spacingLinear)];
    for (const scale of fingeringScales) {
        spacing.fingeringScale = scale;
        for (const variant of spacings) {
            Object.assign(spacing, variant);
            for (const unit of fixedUnit ? [fixedUnit] : SHEET_UNITS) {
                const outcome = fit(unit);
                if (outcome?.error) return outcome;
                if (outcome === 'fits') return { ...result(), spacingTightened: variant !== given };
            }
        }
    }
    Object.assign(spacing, given);
    // Overflow: the best attempt, on more than one page.
    const unit = fixedUnit ?? SHEET_UNITS[SHEET_UNITS.length - 1];
    if (draw(unit, fixedSystems ? startsFor(fixedSystems) : null) === null) return { error: 'load' };
    return result();
}
