.pragma library
.import "musescoreInstruments.js" as MsInstruments

// Ordered longest-match first to avoid "tuba" matching before "tuba eb", etc.
var _nameAliases = [
    ["sax soprano", "sax soprano"],
    ["soprano sax", "sax soprano"],
    ["saxophone soprano", "sax soprano"],
    ["sax ternor", "sax tenor"],
    ["sax tenor", "sax tenor"],
    ["tenor sax", "sax tenor"],
    ["saxophone tenor", "sax tenor"],
    ["sax alta", "sax alto"],
    ["sax alto", "sax alto"],
    ["alto sax", "sax alto"],
    ["saxophone alto", "sax alto"],
    ["tuba eb", "tuba eb"],
    ["flauta transversal", "flauta"],
    ["bombardino", "bombardino"],
    ["euphonium", "bombardino"],
    ["trombone", "trombone"],
    ["bone", "trombone"],
    ["trompette", "trompete"],
    ["trompete", "trompete"],
    ["trumpet", "trompete"],
    ["pete", "trompete"],
    ["clarineta", "clarinete"],
    ["clarinete", "clarinete"],
    ["clarinet", "clarinete"],
    ["flauta", "flauta"],
    ["flute", "flauta"],
    ["sousaphone", "tuba"],
    ["tuba", "tuba"],
];

function _matchByName(part) {
    var haystack = [
        part.longName || "",
        part.partName || "",
        part.shortName || ""
    ].join(" ").toLowerCase().replace(/[_\-.]/g, " ");

    for (var i = 0; i < _nameAliases.length; i++) {
        if (haystack.indexOf(_nameAliases[i][0]) > -1)
            return _nameAliases[i][1];
    }
    return null;
}

function getCaderninhoInstrument(instrumentId, part) {
    switch (instrumentId) {
    case "brass.trombone":
    case "trombone":
    case "brass.trombone.tenor":
        return "trombone";
    case "bb-tuba":
        return "tuba";
    case "brass.tuba":
    case "tuba":
        return MsInstruments.hasEbInPartName(part) ? "tuba eb" : "tuba";
    case "bass-eb-tuba":
        return "tuba eb";
    case "trumpet":
    case "bb-trumpet":
    case "brass.trumpet.bflat":
    case "brass.trumpet":
    case "c-trumpet":
        return "trompete";
    case "euphonium-treble":
    case "brass.euphonium":
    case "euphonium":
        return "bombardino";
    case "wind.flutes.flute":
    case "flute":
        return "flauta";
    case "wind.reed.clarinet.bflat":
    case "wind.reed.clarinet":
    case "clarinet.bflat":
    case "clarinet":
        return "clarinete";
    case "wind.reed.saxophone.alto":
    case "saxophone.alto":
    case "alto-sax":
        return "sax alto";
    case "wind.reed.saxophone.soprano":
    case "saxophone.soprano":
    case "soprano-sax":
        return "sax soprano";
    case "wind.reed.saxophone.tenor":
    case "saxophone.tenor":
    case "tenor-sax":
        return "sax tenor";
    default:
        return part ? _matchByName(part) : null;
    }
}
