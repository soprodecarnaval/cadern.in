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

// A system break before each listed measure. The caller has removed every <print> element.
function withBreaks(musicXml, starts) {
    const breaks = new Set(starts.filter(index => index > 0));
    let index = -1;
    return musicXml.replace(/<measure\b[^>]*>/g, tag => (++index, breaks.has(index) ? tag + '<print new-system="yes"/>' : tag));
}

// Staff sizes tried for a songbook sheet, largest first (half a staff space, tenths of a millimetre).
const SHEET_UNITS = [10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5];
// Songbook sheets keep about this many measures on a system, like the printed booklets.
const MEASURES_PER_SYSTEM = 5;

/**
 * Draw one part as a songbook sheet: the music only, sized to fit `area` on a
 * single page when possible, at the largest staff size, with systems balanced.
 * @param {string} musicXml single-part MusicXML without <print> elements.
 * @param {{ widthMm: number, heightMm: number }} area
 * @param {number[]} widths relative content width of each measure, in order.
 * @returns {Promise<{ pages: string[], staffSpaceMm: number } | { error: 'load' }>}
 */
export async function renderSheet(musicXml, area, widths) {
    const tk = await load();
    const measures = widths.length;
    const draw = (unit, starts) => {
        tk.resetOptions();
        tk.setOptions({
            pageWidth: tenths(area.widthMm), pageHeight: tenths(area.heightMm),
            // Room on the left for measure numbers at the start of a system.
            pageMarginTop: 0, pageMarginRight: 0, pageMarginBottom: 0, pageMarginLeft: 15,
            unit, scale: 100, adjustPageHeight: false, justifyVertically: true, minLastJustification: 0,
            breaks: starts ? 'encoded' : 'auto', header: 'none', footer: 'none',
            spacingLinear: 0.15, spacingNonLinear: 0.55, spacingSystem: 4, fingeringScale: 0.9,
            svgViewBox: true, mmOutput: true, fontTextLiberation: true, svgRemoveXlink: false, xmlIdSeed: 1
        });
        if (!tk.loadData(starts ? withBreaks(musicXml, starts) : musicXml)) return null;
        return tk.getPageCount();
    };
    const result = unit => {
        const pages = [];
        for (let n = 1; n <= tk.getPageCount(); n++) pages.push(withoutPlaceholders(tk.renderToSVG(n, false)));
        return { pages, staffSpaceMm: unit / 5 };
    };
    for (const unit of SHEET_UNITS) {
        const count = draw(unit, null);
        if (count === null) return { error: 'load' };
        if (count !== 1) continue;
        const auto = systems(tk.renderToSVG(1, false));
        // Spread the measures over more systems when the page has room, as the booklets do.
        for (let target = Math.min(measures, Math.max(auto, Math.ceil(measures / MEASURES_PER_SYSTEM))); target >= auto; target--) {
            if (draw(unit, balancedStarts(widths, target)) === 1) return result(unit);
        }
        draw(unit, null);
        return result(unit);
    }
    const unit = SHEET_UNITS[SHEET_UNITS.length - 1];
    if (draw(unit, null) === null) return { error: 'load' };
    return result(unit);
}
