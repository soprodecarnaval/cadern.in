// SPDX-License-Identifier: GPL-3.0-only
// Build the MusicXML for one rendered part from the full-score MusicXML, in
// memory. No per-part files are produced.

export type PageGeometry = { widthMm: number; heightMm: number; marginsMm: [number, number, number, number]; staffSpaceMm: number };
export type PartXml = {
    musicXml: string; geometry: PageGeometry; geometryFromScore: boolean;
    /** Relative content width of each measure of the first kept part, for balancing systems. */
    measureWeights: number[];
    /** Title and creators written in the MusicXML. */
    credits: { title: string; composer: string; lyricist: string };
};
import type { PageSize, PartPageStyle } from './types';

/** Paper for part pages: ISO B6 (the standard print size for these sheets), the score's own page layout, or a custom size. */
export type PartPageSize = 'B6' | 'score' | PageSize;
export const B6 = { widthMm: 125, heightMm: 176 } as const;

const A4: PageGeometry = { widthMm: 210, heightMm: 297, marginsMm: [15, 15, 15, 15], staffSpaceMm: 1.75 };
const EPSILON = 1e-6;
// ISO A3–A5, B4–B6, US Letter, Legal and Tabloid, portrait (width, height) in mm.
const PAPER: [number, number][] = [[297, 420], [210, 297], [148, 210], [250, 353], [176, 250], [125, 176], [215.9, 279.4], [215.9, 355.6], [279.4, 431.8]];
const child = (parent: Element | null | undefined, name: string) => parent ? Array.from(parent.children).find(e => e.localName === name) ?? null : null;
const children = (parent: Element, name: string) => Array.from(parent.children).filter(e => e.localName === name);
const number = (element: Element | null) => { const text = element?.textContent?.trim(); return text && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : NaN; };

/** Page size, margins and staff space from MusicXML `<defaults>`; A4 when absent or implausible. */
function geometry(root: Element): { geometry: PageGeometry; fromScore: boolean } {
    const defaults = child(root, 'defaults');
    const scaling = child(defaults, 'scaling');
    const mmPerTenth = number(child(scaling, 'millimeters')) / number(child(scaling, 'tenths'));
    const layout = child(defaults, 'page-layout');
    const margins = layout ? (children(layout, 'page-margins').find(m => ['both', 'odd', null].includes(m.getAttribute('type'))) ?? null) : null;
    const mm = (parent: Element | null, name: string) => number(child(parent, name)) * mmPerTenth;
    const result: PageGeometry = {
        widthMm: mm(layout, 'page-width'), heightMm: mm(layout, 'page-height'),
        marginsMm: [mm(margins, 'top-margin'), mm(margins, 'right-margin'), mm(margins, 'bottom-margin'), mm(margins, 'left-margin')],
        staffSpaceMm: 10 * mmPerTenth
    };
    const plausible = result.widthMm >= 50 && result.widthMm <= 1000 && result.heightMm >= 50 && result.heightMm <= 1000
        && result.marginsMm.every(m => m >= 0 && m <= 100) && result.staffSpaceMm >= 0.9 && result.staffSpaceMm <= 2.4;
    if (!plausible) {return { geometry: A4, fromScore: false };}
    const round = (value: number) => Math.round(value * 100) / 100;
    // MusicXML tenths carry rounding (MuseScore A4 exports as 210.04 × 296.93 mm);
    // snap to a standard paper size when within half a millimetre.
    const paper = PAPER.flatMap(([w, h]) => [[w, h], [h, w]]).find(([w, h]) => Math.abs(result.widthMm - w) <= 0.5 && Math.abs(result.heightMm - h) <= 0.5);
    if (paper) {[result.widthMm, result.heightMm] = paper;}
    return { geometry: { widthMm: round(result.widthMm), heightMm: round(result.heightMm), marginsMm: result.marginsMm.map(round) as PageGeometry['marginsMm'], staffSpaceMm: round(result.staffSpaceMm) }, fromScore: true };
}

// Markings that apply to the whole system. MuseScore writes them into the top part only.
const SYSTEM_TYPES = new Set(['metronome', 'segno', 'coda', 'rehearsal']);
const SYSTEM_SOUND = ['tempo', 'dacapo', 'dalsegno', 'fine', 'tocoda', 'segno', 'coda'];
function isSystemMarking(direction: Element) {
    if (children(direction, 'direction-type').some(type => Array.from(type.children).some(e => SYSTEM_TYPES.has(e.localName)))) {return true;}
    const sound = child(direction, 'sound');
    return !!sound && SYSTEM_SOUND.some(name => sound.hasAttribute(name));
}
const signature = (direction: Element) => children(direction, 'direction-type').map(type => (type.textContent ?? '').replace(/\s+/g, ' ').trim() + Array.from(type.children, e => e.localName).join()).join('|')
    + '|' + Array.from(child(direction, 'sound')?.attributes ?? [], a => `${a.name}=${a.value}`).sort().join();

/** Start time (in quarter notes) of each child of a measure; returns the divisions in effect afterwards. */
function timeline(measure: Element, divisions: number) {
    const at = new Map<Element, number>();
    let t = 0;
    const duration = (e: Element) => { const d = number(child(e, 'duration')); return Number.isFinite(d) ? d / divisions : 0; };
    for (const e of Array.from(measure.children)) {
        if (e.localName === 'attributes') { const d = number(child(e, 'divisions')); if (d > 0) {divisions = d;} }
        at.set(e, t);
        if (e.localName === 'note' && !child(e, 'chord') && !child(e, 'grace')) {t += duration(e);}
        else if (e.localName === 'backup') {t -= duration(e);}
        else if (e.localName === 'forward') {t += duration(e);}
    }
    return { at, end: t, divisions };
}

/** Copy system-wide directions of the top part into `target` at the same musical position. */
function copySystemMarkings(source: Element, target: Element): void {
    const sourceMeasures = children(source, 'measure'), targetMeasures = children(target, 'measure');
    if (sourceMeasures.length !== targetMeasures.length) {return;}
    let sourceDivisions = 1, targetDivisions = 1;
    sourceMeasures.forEach((measure, index) => {
        const from = timeline(measure, sourceDivisions);
        const into = targetMeasures[index];
        const to = timeline(into, targetDivisions);
        const existing = new Set(children(into, 'direction').filter(isSystemMarking).map(signature));
        for (const direction of children(measure, 'direction').filter(isSystemMarking)) {
            if (existing.has(signature(direction))) {continue;}
            const offset = number(child(direction, 'offset'));
            const time = from.at.get(direction)! + (Number.isFinite(offset) ? offset / from.divisions : 0);
            // Positions in the target's first voice, up to its first backup.
            const candidates: { before: Element | null; time: number }[] = [];
            for (const e of Array.from(into.children)) {
                const t = to.at.get(e)!;
                if ((e.localName === 'note' && !child(e, 'chord')) || e.localName === 'forward' || (e.localName === 'barline' && e.getAttribute('location') === 'right')) {candidates.push({ before: e, time: t });}
                if (e.localName === 'backup') { candidates.push({ before: e, time: t }); break; }
            }
            if (!candidates.some(c => c.before?.localName === 'backup')) {candidates.push({ before: null, time: to.end });}
            const reachable = candidates.filter(c => c.time <= time + EPSILON);
            const latest = Math.max(...reachable.map(c => c.time), 0);
            const at = reachable.find(c => Math.abs(c.time - latest) < EPSILON) ?? candidates[0];
            const clone = direction.cloneNode(true) as Element;
            for (const e of Array.from(clone.children)) {if (['offset', 'staff', 'voice'].includes(e.localName)) {e.remove();}}
            const residual = Math.round((time - (at?.time ?? 0)) * to.divisions);
            if (residual > 0) {
                const element = clone.ownerDocument.createElement('offset');
                element.textContent = String(residual);
                const types = children(clone, 'direction-type');
                types[types.length - 1].after(element);
            }
            into.insertBefore(clone, at?.before ?? null);
        }
        sourceDivisions = from.divisions;
        targetDivisions = to.divisions;
    });
}

/** The score geometry moved onto another paper: margins scale with the page width unless given, staff space is kept. */
function onPaper(page: PageGeometry, paper: PageSize): PageGeometry {
    const ratio = Math.min(paper.widthMm, paper.heightMm) / Math.min(page.widthMm, page.heightMm);
    const round = (value: number) => Math.round(value * 100) / 100;
    const marginsMm = paper.marginsMm ? [...paper.marginsMm] : page.marginsMm.map(m => round(Math.min(m, m * ratio)));
    return { widthMm: paper.widthMm, heightMm: paper.heightMm, marginsMm: marginsMm as PageGeometry['marginsMm'], staffSpaceMm: page.staffSpaceMm };
}

/** Close endings the exporter leaves open (MuseScore writes no stop for a final open volta). */
function closeEndings(part: Element) {
    const doc = part.ownerDocument;
    const close = (measure: Element, number: string) => {
        let barline = children(measure, 'barline').find(b => b.getAttribute('location') === 'right');
        if (!barline) { barline = doc.createElement('barline'); barline.setAttribute('location', 'right'); measure.appendChild(barline); }
        const ending = doc.createElement('ending');
        ending.setAttribute('number', number);
        ending.setAttribute('type', 'discontinue');
        // <ending> precedes <repeat> in a barline.
        barline.insertBefore(ending, child(barline, 'repeat'));
    };
    let open: { measure: Element; number: string } | null = null;
    for (const measure of children(part, 'measure')) {
        for (const barline of children(measure, 'barline')) {
            const ending = child(barline, 'ending');
            const type = ending?.getAttribute('type');
            if (type === 'start') {
                // A new ending begins while another is still open: end the open one where it started.
                if (open) {close(open.measure, open.number);}
                open = { measure, number: ending!.getAttribute('number') ?? '1' };
            } else if (type === 'stop' || type === 'discontinue') {open = null;}
        }
    }
    if (open) {close(open.measure, open.number);}
}

/** Prepare MusicXML for a songbook or fitted sheet: no part labels, no inherited page or system breaks. */
function forSheet(root: Element, parts: Element[]) {
    for (const scorePart of Array.from(root.getElementsByTagName('score-part'))) {
        for (const name of ['part-name', 'part-abbreviation']) {child(scorePart, name)?.setAttribute('print-object', 'no');}
        for (const name of ['part-name-display', 'part-abbreviation-display']) {child(scorePart, name)?.remove();}
    }
    for (const part of parts) {
        for (const print of Array.from(part.getElementsByTagName('print'))) {print.remove();}
        closeEndings(part);
    }
}

/** Keep the full instrumentation and notation, with fingering removed from every staff. */
export function arrangementMusicXml(fullScore: string, labels: ReadonlyMap<string, string> = new Map()): string {
    const doc = new DOMParser().parseFromString(fullScore, 'application/xml');
    const root = doc.documentElement;
    if (root.localName !== 'score-partwise') {throw new Error('Invalid MusicXML');}
    const list = Array.from(root.getElementsByTagName('score-part'));
    for (const part of list) {
        const label = labels.get(part.getAttribute('id') ?? '');
        if (!label) {continue;}
        for (const display of ['part-name-display', 'part-abbreviation-display']) {
            const element = child(part, display);
            if (element) {part.removeChild(element);}
        }
        for (const name of ['part-name', 'part-abbreviation']) {
            const found = child(part, name);
            const element = found ?? doc.createElement(name);
            element.removeAttribute('print-object');
            element.textContent = label;
            if (!found) {
                const before = name === 'part-name' ? part.firstChild : child(part, 'part-name')?.nextSibling ?? null;
                part.insertBefore(element, before);
            }
        }
    }
    for (const tag of ['fingering', 'pluck']) {
        for (const fingering of Array.from(root.getElementsByTagName(tag))) {
            fingering.parentNode?.removeChild(fingering);
        }
    }
    // Some exports represent manually placed fingering numbers as staff text.
    // Require a standalone numeric direction so tempo, repeats and rehearsal marks survive.
    for (const direction of Array.from(root.getElementsByTagName('direction'))) {
        const types = children(direction, 'direction-type');
        const words = types.length === 1 ? children(types[0], 'words') : [];
        const text = words[0]?.textContent?.replace(/<\/?(?:font|b|i|u)\b[^>]*>/gi, '').trim() ?? '';
        if (words.length === 1 && types[0].children.length === 1 && !child(direction, 'sound') &&
            /^(?:[0-9]|1[0-2]|(?=[1-4])1?2?3?4?)$/.test(text)) {
            direction.parentNode?.removeChild(direction);
        }
    }
    return new XMLSerializer().serializeToString(doc);
}

/** MusicXML with only the given parts (in score order); system markings copied from the top part when it is not among them. */
export function partMusicXml(fullScore: string, partIds: readonly string[], pageSize: PartPageSize = 'B6', style: PartPageStyle = 'plain'): PartXml {
    const doc = new DOMParser().parseFromString(fullScore, 'application/xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root.localName !== 'score-partwise') {throw new Error('Invalid MusicXML');}
    const keep = new Set(partIds);
    const list = child(root, 'part-list');
    const bodies = children(root, 'part');
    const top = bodies[0];
    const kept = bodies.filter(part => keep.has(part.getAttribute('id') ?? ''));
    if (!list || !kept.length || kept.length !== keep.size) {throw new Error('Part not in MusicXML');}
    if (!keep.has(top.getAttribute('id') ?? '')) {copySystemMarkings(top, kept[0]);}
    for (const e of Array.from(list.children)) {if (e.localName === 'part-group' || (e.localName === 'score-part' && !keep.has(e.getAttribute('id') ?? ''))) {e.remove();}}
    for (const part of bodies) {if (!keep.has(part.getAttribute('id') ?? '')) {part.remove();}}
    const { geometry: score, fromScore } = geometry(root);
    const page = pageSize === 'score' ? score : onPaper(score, pageSize === 'B6' ? B6 : pageSize);
    if (style !== 'plain') {forSheet(root, kept);}
    // Measure weight for balancing systems: notes and rests of the first voice, plus barline room.
    // (MusicXML `width` reflects the score's justified layout, not the content.)
    const measureWeights = children(kept[0], 'measure').map(measure => {
        let events = 0;
        for (const e of Array.from(measure.children)) {
            if (e.localName === 'backup') {break;}
            if (e.localName === 'note' && !child(e, 'chord') && !child(e, 'grace')) {events++;}
        }
        return events + 2;
    });
    const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const identification = child(root, 'identification');
    const creator = (type: string) => text(identification ? children(identification, 'creator').find(c => c.getAttribute('type') === type) ?? null : null);
    const credits = { title: text(child(child(root, 'work'), 'work-title')) || text(child(root, 'movement-title')), composer: creator('composer'), lyricist: creator('lyricist') };
    return { musicXml: new XMLSerializer().serializeToString(doc), geometry: page, geometryFromScore: fromScore, measureWeights, credits };
}
