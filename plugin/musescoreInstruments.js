.pragma library
.import "fingerings.js" as Fingerings

function hasEbInPartName(part) {
    if (!part || !part.longName) return false;
    return part.partName.indexOf("Eb") > -1 || part.partName.indexOf("E♭") > -1 ||
           part.longName.indexOf("Eb") > -1 || part.longName.indexOf("E♭") > -1 ||
           part.shortName.indexOf("Eb") > -1 || part.shortName.indexOf("E♭") > -1;
}

function getGriffFn(instrumentId, part, oneChar, breakLine) {
    var griffFn, transposition;
    switch (instrumentId) {
    case "brass.trombone":
    case "trombone":
    case "brass.trombone.tenor":
        griffFn = Fingerings.griff_trombone;
        transposition = 2;
        break;
    case "bb-tuba":
        griffFn = oneChar ? Fingerings.griff_tuba_onechar : Fingerings.griff_tuba;
        transposition = 2;
        break;
    case "brass.tuba":
    case "tuba":
        griffFn = oneChar ? Fingerings.griff_tuba_onechar : Fingerings.griff_tuba;
        transposition = hasEbInPartName(part) ? -3 : 2;
        break;
    case "bass-eb-tuba":
        griffFn = oneChar ? Fingerings.griff_tuba_onechar : Fingerings.griff_tuba;
        // transposition = -3; // concerto
        transposition = -12; // transposto
        break;
    case "trumpet":
    case "bb-trumpet":
    case "brass.trumpet.bflat":
    case "brass.trumpet":
        griffFn = Fingerings.griff_trumpet;
        transposition = 2;
        break;
    case "euphonium-treble":
    case "brass.euphonium":
    case "euphonium":
        griffFn = oneChar ? Fingerings.griff_euphonium_onechar : Fingerings.griff_euphonium;
        transposition = 2;
        break;
    case "c-trumpet":
        griffFn = Fingerings.griff_trumpet;
        transposition = 0;
        break;
    default:
        return null;
    }
    return function(midi) {
        return griffFn(midi + transposition, breakLine);
    };
}
