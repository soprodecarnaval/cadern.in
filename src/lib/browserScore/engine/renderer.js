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

// Expanded IDs distinguish repeat passes. Each pass highlights the same
// notated SVG note, while its own on/off events delimit the sounding interval.
function partPlayback(tk) {
    try {
        const active = new Map(), notated = new Map();
        const frames = [];
        for (const event of tk.renderToTimemap()) {
            if (!event.on?.length && !event.off?.length) continue;
            for (const id of event.off ?? []) active.delete(id);
            for (const id of event.on ?? []) {
                if (!notated.has(id)) notated.set(id, tk.getNotatedIdForElement(id) || id);
                active.set(id, notated.get(id));
            }
            frames.push({ timeMs: event.tstamp, notes: [...new Set(active.values())] });
        }
        const midi = tk.renderToMIDI();
        return midi && frames.length ? { midi, frames } : undefined;
    } catch {
        // A playable excerpt is optional. The SVG remains available for formatting.
        return undefined;
    }
}

/**
 * @param {string} musicXml MusicXML containing only the parts to draw.
 * @param {{ widthMm: number, heightMm: number, marginsMm: number[], staffSpaceMm: number, singlePage?: boolean, staffSpacing?: number }} page
 * @returns {Promise<{ pages: string[] } | { error: 'load' }>}
 */
export async function renderMusicXml(musicXml, page, includePlayback = false) {
    const tk = await load();
    const [top, right, bottom, left] = page.marginsMm.map(mm => range(mm, 0, 100, 10));
    const desiredUnit = range(page.staffSpaceMm, 0.8, 8, 1.8) * 5;
    const unit = page.singlePage ? Math.max(4.5, Math.min(12, desiredUnit)) : range(desiredUnit, 4.5, 12, 9);
    const layoutAt = (paperScale) => {
        tk.resetOptions();
        tk.setOptions({
            pageWidth: tenths(page.widthMm * paperScale), pageHeight: tenths(page.heightMm * paperScale),
            pageMarginTop: tenths(top * paperScale), pageMarginRight: tenths(right * paperScale),
            pageMarginBottom: tenths(bottom * paperScale), pageMarginLeft: tenths(left * paperScale),
            unit, scale: 100, adjustPageHeight: false,
            breaks: 'auto', header: 'auto', footer: 'none', svgViewBox: true, mmOutput: true,
            fontTextLiberation: true, svgRemoveXlink: false, xmlIdSeed: 1,
            ...(page.singlePage ? { spacingStaff: Math.round(range(page.staffSpacing, 0, 48, 4)) } : {}),
        });
        if (!tk.loadData(musicXml)) return null;
        const count = tk.getPageCount();
        if (page.singlePage && count > 1) return { growth: Math.max(1.2, Math.sqrt(count) * 0.9) };
        const pages = [];
        let lowest = 0;
        for (let n = 1; n <= count; n++) {
            const svg = withoutPlaceholders(tk.renderToSVG(n, false));
            pages.push(svg);
            if (page.singlePage) {
                for (const line of svg.matchAll(/<path d="M[\d.]+ ([\d.]+) L[\d.]+ \1"[^>]*stroke-width/g)) {
                    lowest = Math.max(lowest, Number(line[1]));
                }
            }
        }
        const usable = (page.heightMm - top - bottom) * paperScale * 100;
        if (!page.singlePage || lowest + 2 * unit * 20 <= usable) {
            return { pages };
        }
        return { growth: Math.max(1.08, (lowest + 2 * unit * 20) / usable * 1.05) };
    };
    let paperScale = page.singlePage ? unit / desiredUnit : 1, tooSmall = 0;
    // Bounds of Verovio's virtual paper, in millimetres.
    const maxScale = Math.min(10000 / page.widthMm, 6000 / page.heightMm);
    for (let attempt = 0; attempt < 10; attempt++) {
        let result = layoutAt(paperScale);
        if (!result) break;
        if (result.pages) {
            // Use the smallest known canvas that fits, so the final A4 staff
            // size is close to the largest usable size.
            if (tooSmall) {
                let fits = paperScale;
                for (let probe = 0; probe < 3; probe++) {
                    const middle = (tooSmall + fits) / 2;
                    result = layoutAt(middle);
                    if (result?.pages) fits = middle;
                    else tooSmall = middle;
                }
                paperScale = fits;
                result = layoutAt(fits);
            }
            if (result?.pages) return {
                pages: result.pages,
                staffSpaceMm: unit / 5 / paperScale,
                playback: includePlayback ? partPlayback(tk) : undefined,
            };
            break;
        }
        tooSmall = paperScale;
        paperScale = Math.min(paperScale * result.growth, maxScale);
        if (paperScale <= tooSmall) break;
    }
    return { error: 'load' };
}

// Fingering baselines sit at least this far above the top staff line.
const FINGERING_GAP = 0.6, CHORD_STEP = 2.3;
const COMFORTABLE_GAP = 1.45, MAX_PITCH_RISE = 3, MAX_FINGERING_STEP = 2;
// Extra staff spaces reserved above the renderer's default fingering row.
export const FINGERING_ROOM = 2;
// Verovio 6.4 rejects fingeringScale above 1 and uses its default of 0.75.
const VEROVIO_FINGERING_MAX = 1;

// A chord is a Verovio group. Nearby horizontal positions can also be
// consecutive notes, so proximity alone cannot identify chord members.
function chordMembers(svg, notes) {
    const members = new Map();
    if (!svg.includes('class="chord"')) return members;
    const groups = [];
    for (const tag of svg.matchAll(/<g\b[^>]*>|<\/g>/g)) {
        const text = tag[0];
        if (text === '</g>') { groups.pop(); continue; }
        const chord = /\bclass="chord"/.test(text) ? [] : groups.at(-1);
        const id = /\bid="([^"]+)"/.exec(text)?.[1];
        const note = id && notes.get(id);
        if (note && chord) {
            chord.push(note);
            members.set(id, chord);
        }
        if (!text.endsWith('/>')) groups.push(chord);
    }
    return members;
}

/**
 * Moves each fingering of a drawn page from Verovio's common row into a band above the staff: never
 * inside the staff, higher for higher notes, as the plugin did, so the numbers trace the melody; and
 * always above its own note when that is above the staff. Repeated pitches on the same staff
 * share one baseline. Collision corrections for nearby markings are manual.
 * Each staff in a system has its own pitch range. The biggest step between notes limits the
 * contour's slope, and a larger inter-system gap gives the numbers more breathing room.
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
    const notes = new Map(), systemBottoms = [], staffBottoms = [];
    let staffTop = null, system = -1, pendingStaff = false;
    const token = /class="system"|class="staff"|<path d="M[\d.]+ ([\d.]+) L[\d.]+ \1"|<g id="([^"]+)" class="note"[^>]*>\s*<g class="notehead">\s*<use [^>]*transform="translate\(([\d.]+), ([\d.]+)\)/g;
    for (const match of svg.matchAll(token)) {
        if (match[0] === 'class="system"') { system++; staffTop = null; pendingStaff = false; continue; }
        if (match[0] === 'class="staff"') {
            system = Math.max(0, system);
            staffTop = null;
            pendingStaff = true;
            continue;
        }
        if (match[1] !== undefined) {
            if (pendingStaff) {
                pendingStaff = false;
                staffTop = Number(match[1]);
                const edges = staffBottoms[system] ??= new Map();
                edges.set(staffTop, Math.max(edges.get(staffTop) ?? 0, staffTop + 4 * space));
                systemBottoms[system] = Math.max(systemBottoms[system] ?? 0, staffTop + 4 * space);
            }
            continue;
        }
        if (staffTop === null) continue;
        const note = { id: match[2], y: Number(match[4]), staffTop, system };
        notes.set(note.id, note);
        const edges = staffBottoms[system];
        edges.set(staffTop, Math.max(edges.get(staffTop), note.y + space));
        systemBottoms[system] = Math.max(systemBottoms[system], note.y + space);
    }
    const chords = chordMembers(svg, notes);
    const anchors = new Map(), staffBands = new Map();
    const numbers = /(<g [^>]*class="fing"[^>]*data-startid="#([^"]+)"[^>]*>\s*<text [^>]*?\by=")(-?[\d.]+)("[\s\S]*?<tspan font-size="([1-9][\d.]*)px")/g;
    for (const [, , id, , , fontSize] of svg.matchAll(numbers)) {
        const note = notes.get(id);
        if (!note) continue;
        const chord = chords.get(note.id) ?? [note];
        const chordTop = chord.reduce((high, other) => Math.min(high, other.y), note.y);
        // Verovio emits a staff group per measure. Group those on the same line
        // across the system while keeping multiple staves in a system separate.
        const key = `${note.system}:${note.staffTop}`;
        const band = staffBands.get(key) ?? {
            system: note.system, top: note.staffTop, pitches: [], clearance: new Map(), pageTop: -Infinity,
        };
        staffBands.set(key, band);
        anchors.set(id, { pitch: note.y, band });
        band.pitches.push(note.y);
        band.pageTop = Math.max(band.pageTop, Number(fontSize) * 0.72 - space * FINGERING_ROOM);
        // Apply the tightest notehead/chord clearance to every occurrence of a pitch.
        const overNote = chordTop - space * (0.5 + (chord.length - 1) * CHORD_STEP);
        band.clearance.set(note.y, Math.min(band.clearance.get(note.y) ?? Infinity, overNote));
    }
    if (!anchors.size) return svg;
    for (const band of staffBands.values()) {
        let previousBottom = systemBottoms[band.system - 1];
        for (const [top, bottom] of staffBottoms[band.system]) {
            if (top < band.top) previousBottom = Math.max(previousBottom ?? 0, bottom);
        }
        const room = Math.max(0, band.top - (previousBottom === undefined ? 2 * space : previousBottom + 4 * space));
        let lowest = -Infinity, highest = Infinity, maxStep = 0;
        let previousY;
        // The renderer emits fingerings in score order, across measure groups.
        for (const pitch of band.pitches) {
            lowest = Math.max(lowest, pitch);
            highest = Math.min(highest, pitch);
            if (previousY !== undefined) maxStep = Math.max(maxStep, Math.abs(pitch - previousY));
            previousY = pitch;
        }
        band.gap = Math.max(FINGERING_GAP * space, Math.min(COMFORTABLE_GAP * space, room / 3));
        band.lowest = lowest;
        const range = lowest - highest;
        band.slope = range > 0 ? Math.min(MAX_PITCH_RISE * space / range,
            Math.max(space, room - band.gap) / range, MAX_FINGERING_STEP * space / maxStep) : 0;
    }
    return svg.replace(numbers, (whole, head, id, _y, tail) => {
        const anchor = anchors.get(id);
        if (!anchor) return whole;
        const { band, pitch } = anchor;
        const contour = band.top - band.gap - (band.lowest - pitch) * band.slope;
        const overNote = band.clearance.get(pitch) - band.gap;
        const y = Math.round(Math.max(band.pageTop, Math.min(contour, overNote)));
        return head + y + tail;
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
 * Index of the largest staff size (units, largest first) at which `fit` reports 'fits', or null.
 * A smaller staff never needs more pages, so the sizes that fit are a tail of the list: a binary
 * search finds its first entry in about 5 layouts instead of trying every size from the largest.
 * Deterministic for a given input, like the linear search it replaces.
 */
// Verovio's largest `unit` (2.4 mm staff space); a staff size fixed above it, up to
// MAX_FIXED_UNIT (8 mm), is drawn at this unit and enlarged with Verovio's `scale`.
const VEROVIO_MAX_UNIT = 12;
const MAX_FIXED_UNIT = 40;
/** The Verovio unit and enlargement that draw `unit`; the enlargement is a whole percentage. */
export function verovioScale(unit) {
    if (unit <= VEROVIO_MAX_UNIT) return { verovioUnit: unit, zoom: 1 };
    // Rounded up, so the unit stays within what Verovio accepts.
    const zoom = Math.ceil(unit / VEROVIO_MAX_UNIT * 100) / 100;
    return { verovioUnit: unit / zoom, zoom };
}

function largestFitting(units, fit) {
    const last = fit(units[units.length - 1]);
    if (last?.error) return last;
    if (last !== 'fits') return null;
    let low = 0, high = units.length - 1; // units[high] fits
    while (low < high) {
        const middle = (low + high) >> 1;
        const outcome = fit(units[middle]);
        if (outcome?.error) return outcome;
        if (outcome === 'fits') high = middle; else low = middle + 1;
    }
    return high;
}

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
 * @param {{ unit?: number, systems?: number, spacingLinear?: number, spacingNonLinear?: number, spacingSystem?: number, evenNoteSpacing?: boolean, fingeringScale?: number }} [layout]
 * @returns {Promise<{ pages: string[], staffSpaceMm: number, systems: number, contentHeightMm: number } | { error: 'load' }>}
 */
export async function renderSheet(musicXml, area, widths, layout = {}, includePlayback = false) {
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
    const options = (unit, starts, natural) => {
        // Above Verovio's largest unit the drawing is enlarged instead: laid out on a page `zoom`
        // times smaller, then scaled up to the area.
        const { verovioUnit, zoom } = verovioScale(unit);
        return {
        pageWidth: Math.round(tenths(area.widthMm) / zoom), pageHeight: Math.round(tenths(area.heightMm) / zoom),
        // Room on the left for measure numbers at the start of a system.
        pageMarginTop: Math.round(fingeringRoom() * 2 * verovioUnit), pageMarginRight: 0, pageMarginBottom: 0, pageMarginLeft: Math.round(15 / zoom),
        unit: verovioUnit, scale: Math.round(zoom * 100), adjustPageHeight: natural, justifyVertically: !natural, minLastJustification: 0,
        breaks: starts ? 'line' : 'auto', header: 'none', footer: 'none',
        ...spacing,
        evenNoteSpacing: layout.evenNoteSpacing === true,
        fingeringScale: Math.min(spacing.fingeringScale, VEROVIO_FINGERING_MAX),
        spacingSystem: spacing.spacingSystem + fingeringRoom(),
        svgViewBox: true, mmOutput: true, fontTextLiberation: true, svgRemoveXlink: false, xmlIdSeed: 1,
        // Links each fingering to its note, for withNoteHeightFingerings.
        svgAdditionalAttribute: ['fing@startid']
        };
    };
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
        for (let n = 1; n <= tk.getPageCount(); n++) pages.push(withNoteHeightFingerings(withoutPlaceholders(tk.renderToSVG(n, false)), verovioScale(current.unit).verovioUnit, fontMultiplier()));
        const playback = includePlayback ? partPlayback(tk) : undefined;
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
        return { pages, playback, staffSpaceMm: unit / 5, systems: count, contentHeightMm, fingeringScale: spacing.fingeringScale };
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
    const fixedUnit = Number.isFinite(layout.unit) ? range(layout.unit, 4, MAX_FIXED_UNIT, SHEET_UNITS[0]) : null;
    // Dense parts that fit no staff size get tighter horizontal spacing (fewer, fuller systems)
    // before smaller fingerings; the plugin's MuseScore spacing was tighter for such music.
    const given = { spacingLinear: spacing.spacingLinear, spacingNonLinear: spacing.spacingNonLinear };
    const spacings = [given, ...TIGHTER_SPACING.filter(tight => tight.spacingLinear < given.spacingLinear)];
    const units = fixedUnit ? [fixedUnit] : SHEET_UNITS;
    for (const scale of fingeringScales) {
        spacing.fingeringScale = scale;
        for (const variant of spacings) {
            Object.assign(spacing, variant);
            const found = largestFitting(units, fit);
            if (found?.error) return found;
            if (found === null) continue;
            // The search may have drawn other sizes last: draw the chosen one again.
            const outcome = fit(units[found]);
            if (outcome?.error) return outcome;
            return { ...result(), spacingTightened: variant !== given };
        }
    }
    Object.assign(spacing, given);
    // Overflow: the best attempt, on more than one page.
    const unit = fixedUnit ?? SHEET_UNITS[SHEET_UNITS.length - 1];
    if (draw(unit, fixedSystems ? startsFor(fixedSystems) : null) === null) return { error: 'load' };
    return result();
}
