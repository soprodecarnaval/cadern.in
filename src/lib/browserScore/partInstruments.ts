// SPDX-License-Identifier: GPL-3.0-only
import type { PartInstrument } from './types';
import type { ScorePartInfo } from './input';
import type { NativePart } from './excerptLinks';

/**
 * The MSCX instruments of one engine excerpt. The main-score parts the file links the excerpt to
 * (`masterParts`, see excerptLinks) decide first. Saved parts are matched by the score part ids in
 * their own file; otherwise each engine part is matched to the score part with the same track
 * name or instrument long name, and finally by position when every excerpt is a single score
 * part in score order (generated parts). Engine parts left unmatched fall back to the engine's
 * MusicXML sound id, without names.
 */
export function excerptInstruments(
    excerpt: { title: string; parts: readonly NativePart[] },
    index: number,
    excerptCount: number,
    info: { savedPartIds: Readonly<Record<string, readonly string[]>>; scoreParts: readonly ScorePartInfo[] },
    masterParts?: readonly number[] | null
): PartInstrument[] {
    const linked = masterParts?.map(at => info.scoreParts[at]);
    if (linked?.length && linked.every(Boolean)) {return linked.flatMap(part => part.instruments);}
    const saved = info.savedPartIds[excerpt.title];
    if (saved?.length) {
        const parts = saved.map(id => info.scoreParts.find(part => part.partId === id));
        if (parts.every(Boolean)) {return parts.flatMap(part => part!.instruments);}
    }
    const nativeParts = excerpt.parts || [];
    const byPosition = excerptCount === info.scoreParts.length && nativeParts.length === 1 ? info.scoreParts[index] : undefined;
    return nativeParts.flatMap(native => {
        const name = native.name?.trim(), long = native.instrumentName?.trim();
        const match = (name && info.scoreParts.find(part => part.trackName === name))
            || (long && info.scoreParts.find(part => part.instruments.some(instrument => instrument.longName === long)))
            || byPosition;
        if (match) {return match.instruments;}
        return native.instrumentId ? [{ id: '', soundId: native.instrumentId, longName: long ?? '', shortName: '' }] : [];
    });
}

export const instrumentIdsOf = (instruments: readonly PartInstrument[]): string[] =>
    instruments.map(instrument => instrument.id || instrument.soundId || '').filter(Boolean);
