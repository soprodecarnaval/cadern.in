.pragma library
.import "fingerings.js" as Fingerings

function hasEbInPartName(part) {
    if (!part) return false;
    var names = [part.partName || "", part.longName || "", part.shortName || ""].join(" ");
    return /Eb|E♭/.test(names);
}

function tubaSettings(tuning, mode, nativeTranspose, canResetInstrument) {
    return {
        griffFn: Fingerings.griff_tuba,
        oneCharFn: Fingerings.griff_tuba_onechar,
        // The table is indexed as a C tuba: sounding Bb/Eb open notes map to C.
        transposition: tuning === "Eb" ? -3 : 2,
        tubaPolicy: {
            tuning: tuning,
            mode: mode,
            nativeTranspose: nativeTranspose,
            canResetInstrument: canResetInstrument !== false
        }
    };
}

function getInstrumentSettings(instrumentId, part) {
    switch (instrumentId) {
    case "bb-tuba":
    case "sousaphone":
        return tubaSettings("Bb", "concert-octave", 0);
    case "bass-eb-tuba":
    case "eb-tuba":
        return tubaSettings("Eb", "concert-octave", 0);
    case "bb-tuba-treble":
    case "bb-sousaphone-treble":
        return tubaSettings("Bb", "transposed-treble", -26);
    case "eb-tuba-treble":
        return tubaSettings("Eb", "transposed-treble", -21);
    case "bb-sousaphone":
        return tubaSettings("Bb", "transposed-bass", -14);
    case "tuba":
        return tubaSettings(hasEbInPartName(part) ? "Eb" : "Bb", "concert-octave", 0);
    case "brass.tuba":
        return tubaSettings(hasEbInPartName(part) ? "Eb" : "Bb", "concert-octave", 0, false);
    case "brass.trombone":
    case "trombone":
    case "brass.trombone.tenor":
        return { griffFn: Fingerings.griff_trombone, transposition: 2, dynamicTrombone: true };
    case "trumpet":
    case "bb-trumpet":
    case "brass.trumpet.bflat":
    case "brass.trumpet":
        return { griffFn: Fingerings.griff_trumpet, transposition: 2 };
    case "euphonium-treble":
    case "brass.euphonium":
    case "euphonium":
        return { griffFn: Fingerings.griff_euphonium, oneCharFn: Fingerings.griff_euphonium_onechar, transposition: 2 };
    case "c-trumpet":
        return { griffFn: Fingerings.griff_trumpet, transposition: 0 };
    default:
        return null;
    }
}

function getTubaPolicy(instrumentId, part) {
    var settings = getInstrumentSettings(instrumentId, part);
    return settings && settings.tubaPolicy ? settings.tubaPolicy : null;
}

function getGriffFn(instrumentId, part, oneChar, breakLine, dynamicTrombone) {
    var settings = getInstrumentSettings(instrumentId, part);
    if (!settings)
        return null;
    if (settings.dynamicTrombone && dynamicTrombone) {
        var picker = Fingerings.newTrombonePicker();
        return function(midi) {
            return picker.pick(midi + settings.transposition);
        };
    }
    var griffFn = oneChar && settings.oneCharFn ? settings.oneCharFn : settings.griffFn;
    return function(midi) {
        return griffFn(midi + settings.transposition, breakLine);
    };
}
