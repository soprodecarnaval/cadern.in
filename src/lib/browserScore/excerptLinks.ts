// SPDX-License-Identifier: GPL-3.0-only
// Which main-score parts each engine excerpt draws from (ticket 022).
import type { InlineExcerpt, ScorePartInfo } from './input';

export type NativePart = { instrumentName: string; name: string; instrumentId?: string };
export type EngineMetadata = { excerpts: readonly { title: string; parts?: readonly NativePart[] }[]; parts: readonly NativePart[] };
export type ExcerptLinkInfo = {
    savedPartIds: Readonly<Record<string, readonly string[]>>;
    scoreParts: readonly ScorePartInfo[];
    inlineExcerpts?: readonly InlineExcerpt[];
};

/**
 * Indices of the main-score parts excerpt `index` is linked to in the file, or null when the
 * file does not say: 4.x saved parts by their part ids, 3.x inline excerpts by their staff links
 * (in file order, which is the engine's, when the counts and titles agree).
 */
export function excerptMasterParts(metadata: EngineMetadata, index: number, info: ExcerptLinkInfo): number[] | null {
    const excerpt = metadata.excerpts[index];
    if (!excerpt) {return null;}
    const saved = info.savedPartIds[excerpt.title];
    if (saved?.length) {
        const at = saved.map(id => info.scoreParts.findIndex(part => part.partId === id));
        return at.every(i => i >= 0) ? at : null;
    }
    const inline = info.inlineExcerpts ?? [];
    if (inline.length !== metadata.excerpts.length) {return null;}
    const linked = inline[index];
    if (!linked.masterParts.length || (linked.title && linked.title !== excerpt.title?.trim())) {return null;}
    return linked.masterParts.every(i => i < info.scoreParts.length) ? [...linked.masterParts] : null;
}

const key = (part: NativePart) => [part.name, part.instrumentName, part.instrumentId ?? ''].join('\u0000');

/**
 * MusicXML part ids for each excerpt (null when it cannot be matched). MusicXML lists the
 * main-score parts in score order. The file's links decide first; otherwise each engine part is
 * matched by identity (name, instrument name, id) against the main-score parts, and identical
 * main-score parts are given out in score order when exactly as many excerpt parts use them.
 */
export function musicXmlTargets(metadata: EngineMetadata, ids: readonly string[], info: ExcerptLinkInfo): (string[] | null)[] {
    const masterKeys = metadata.parts.length === ids.length ? metadata.parts.map(key) : [];
    const uses = new Map<string, number>();
    for (const excerpt of metadata.excerpts) {
        for (const part of excerpt.parts ?? []) {uses.set(key(part), (uses.get(key(part)) ?? 0) + 1);}
    }
    const given = new Map<string, number>();
    const byKey = metadata.excerpts.map(excerpt => (excerpt.parts ?? []).map(part => {
        const k = key(part);
        const candidates = masterKeys.flatMap((other, at) => other === k ? [at] : []);
        if (candidates.length === 1) {return ids[candidates[0]];}
        if (candidates.length < 2 || uses.get(k) !== candidates.length) {return null;}
        const n = given.get(k) ?? 0;
        given.set(k, n + 1);
        return ids[candidates[n]];
    }));
    const valid = (targets: (string | null | undefined)[]): string[] | null =>
        targets.length && targets.every(Boolean) && new Set(targets).size === targets.length ? targets as string[] : null;
    return metadata.excerpts.map((_, index) => {
        const linked = ids.length === info.scoreParts.length ? excerptMasterParts(metadata, index, info) : null;
        return (linked && valid(linked.map(at => ids[at]))) || valid(byKey[index]);
    });
}
