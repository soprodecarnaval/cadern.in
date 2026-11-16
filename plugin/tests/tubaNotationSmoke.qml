import QtQuick 2.9
import MuseScore 3.0

// Run on a disposable copy of test-scores/tuba-notation.mscz via --extension.
MuseScore {
    requiresScore: true

    function notesSnapshot() {
        var result = [];
        for (var i = 0; i < curScore.parts.length; i++) {
            var part = curScore.parts[i];
            for (var track = part.startTrack; track < part.endTrack; track++) {
                var cursor = curScore.newCursor();
                cursor.track = track;
                cursor.rewind(0);
                while (cursor.segment) {
                    if (cursor.element && cursor.element.type === Element.CHORD) {
                        for (var n = 0; n < cursor.element.notes.length; n++) {
                            var note = cursor.element.notes[n];
                            result.push([track, cursor.tick, note.pitch, note.tpc1, note.tieBack != null]);
                        }
                    }
                    cursor.next();
                }
            }
        }
        return JSON.stringify(result);
    }

    function clefsSnapshot() {
        var result = [];
        var segment = curScore.firstSegment();
        while (segment) {
            for (var staff = 0; staff < curScore.nstaves; staff++) {
                var clef = segment.elementAt(staff * 4);
                if (clef && clef.type === Element.CLEF)
                    result.push([staff, segment.tick, clef.concertClefType, clef.transposingClefType]);
            }
            segment = segment.next;
        }
        return JSON.stringify(result);
    }

    onRun: {
        var component = Qt.createComponent("../caderninhoFormatter.qml");
        if (component.status !== Component.Ready) {
            curScore.setMetaTag("caderninSmoke", "ERROR " + component.errorString());
            return;
        }
        var formatter = component.createObject(this);
        try {
            var before = notesSnapshot();
            formatter.setStyle(curScore);
            var once = clefsSnapshot();
            formatter.setStyle(curScore);
            if (once !== clefsSnapshot())
                throw new Error("Repeated formatting changed clefs");
            var concertPitch = curScore.style.value("concertPitch");
            curScore.startCmd();
            curScore.style.setValue("concertPitch", !concertPitch);
            curScore.endCmd();
            formatter.setStyle(curScore);
            if (once !== clefsSnapshot())
                throw new Error("Score display changed the notation policy");
            curScore.startCmd();
            curScore.style.setValue("concertPitch", concertPitch);
            curScore.endCmd();
            curScore.startCmd();
            try {
                formatter.griffScore(curScore);
            } finally {
                curScore.endCmd();
            }
            if (before !== notesSnapshot())
                throw new Error("Formatting changed pitches, spelling, timing or ties");
            curScore.setMetaTag("caderninSmoke", "OK");
        } catch (error) {
            curScore.setMetaTag("caderninSmoke", "ERROR " + error);
        }
        formatter.destroy();
    }
}
