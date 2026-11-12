.pragma library
.import "musescoreInstruments.js" as MsInstruments

// Caller owns the undo command, shared with the other page-formatting changes.
function apply(score, api) {
    if (!api.ClefType || api.ClefType.F8_VB === undefined) {
        api.log("Tuba notation requires MuseScore 4.6 or later.");
        return;
    }
    var targets = {};
    for (var i = 0; i < score.parts.length; i++) {
        var part = score.parts[i];
        var policy = MsInstruments.getTubaPolicy(part.instrumentId, part);
        if (!policy || policy.mode === "transposed-bass")
            continue;
        if (part.instruments && part.instruments.length > 1) {
            api.log("Skipping tuba notation for a part with instrument changes: " + part.partName);
            continue;
        }
        var firstStaff = part.startTrack / 4;
        var staff = score.staves && score.staves[firstStaff];
        if (!staff || typeof staff.transpose !== "function") {
            api.log("Tuba notation requires MuseScore 4.6 or later.");
            continue;
        }
        var interval = staff.transpose(api.fraction(0, 1));
        if (interval.chromatic !== policy.nativeTranspose) {
            // Reset only customized transpositions; a clef cannot cancel them.
            if (typeof score.replaceInstrument !== "function" || !policy.canResetInstrument) {
                api.log("Cannot reset customized tuba transposition: " + part.instrumentId);
                continue;
            }
            var longName = part.longName;
            var shortName = part.shortName;
            score.replaceInstrument(part, part.instrumentId);
            score.setInstrumentName(part, api.fraction(0, 1), longName);
            score.setInstrumentAbbreviature(part, api.fraction(0, 1), shortName);
        }
        for (var staffIdx = firstStaff; staffIdx < part.endTrack / 4; staffIdx++) {
            targets[staffIdx] = {
                concert: policy.mode === "concert-octave" ? api.ClefType.F8_VB : api.ClefType.F,
                transposing: policy.mode === "concert-octave" ? api.ClefType.F8_VB : api.ClefType.G,
                found: false
            };
        }
    }
    var segment = score.firstSegment();
    while (segment) {
        for (var key in targets) {
            var target = targets[key];
            var clef = segment.elementAt(Number(key) * 4);
            if (!clef || clef.type !== api.Element.CLEF)
                continue;
            if (clef.concertClefType !== target.concert)
                clef.concertClefType = target.concert;
            if (clef.transposingClefType !== target.transposing)
                clef.transposingClefType = target.transposing;
            if (segment.tick === 0)
                target.found = true;
        }
        segment = segment.next;
    }
    for (var key in targets) {
        var target = targets[key];
        if (target.found)
            continue;
        var cursor = score.newCursor();
        cursor.staffIdx = Number(key);
        cursor.voice = 0;
        cursor.rewind(0);
        if (!cursor.segment)
            continue;
        var clef = api.newElement(api.Element.CLEF);
        clef.concertClefType = target.concert;
        clef.transposingClefType = target.transposing;
        cursor.add(clef);
    }
}
