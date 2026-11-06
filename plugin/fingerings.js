.pragma library

// Takes written MIDI pitch of a C trumpet (concert pitch). Bb trumpet callers add 2 before calling.
function griff_trumpet(midi, breakLine) {
    var lb = breakLine ? "\n" : "";
    switch (midi) {
    case 54: return "1" + lb + "2" + lb + "3";
    case 55: return "1" + lb + "3";
    case 56: return "2" + lb + "3";
    case 57: return "1" + lb + "2";
    case 58: return "1";
    case 59: return "2";
    case 60: return "0";
    case 61: return "1" + lb + "2" + lb + "3";
    case 62: return "1" + lb + "3";
    case 63: return "2" + lb + "3";
    case 64: return "1" + lb + "2";
    case 65: return "1";
    case 66: return "2";
    case 67: return "0";
    case 68: return "2" + lb + "3";
    case 69: return "1" + lb + "2";
    case 70: return "1";
    case 71: return "2";
    case 72: return "0";
    case 73: return "1" + lb + "2";
    case 74: return "1";
    case 75: return "2";
    case 76: return "0";
    case 77: return "1";
    case 78: return "2";
    case 79: return "0";
    case 80: return "2" + lb + "3";
    case 81: return "1" + lb + "2";
    case 82: return "1";
    case 83: return "2";
    case 84: return "0";
    case 85: return "2";
    case 86: return "1";
    default: return "";
    }
}

function griff_trombone(midi) {
    switch (midi) {
    case 43: return "6";
    case 44: return "5";
    case 45: return "4";
    case 46: return "3";
    case 47: return "2";
    case 48: return "1";
    case 49: return "7";
    case 50: return "6";
    case 51: return "5";
    case 52: return "4";
    case 53: return "3";
    case 54: return "2";
    case 55: return "1";
    case 56: return "5";
    case 57: return "4";
    case 58: return "3";
    case 59: return "2";
    case 60: return "1";
    case 61: return "4";
    case 62: return "3";
    case 63: return "2";
    case 64: return "1";
    case 65: return "3";
    case 66: return "2";
    case 67: return "1";
    case 68: return "3";
    case 69: return "2";
    case 70: return "3";
    case 71: return "1";
    default: return "";
    }
}

var trombonePositions = {
    43: [6], 44: [5], 45: [4], 46: [3], 47: [2], 48: [1], 49: [7],
    50: [6], 51: [5], 52: [4], 53: [3], 54: [2, 7], 55: [1, 6],
    56: [5], 57: [4], 58: [3, 7], 59: [2, 6], 60: [1, 5], 61: [4, 7],
    62: [3, 6], 63: [2, 5], 64: [1, 4], 65: [3], 66: [2, 7], 67: [1, 6],
    68: [5, 7], 69: [4, 6], 70: [3, 5, 7], 71: [2, 4, 6], 72: [1, 3, 5],
    73: [2, 4, 7], 74: [1, 3, 6], 75: [2, 5], 76: [1, 4]
};

function newTrombonePicker() {
    var prev = null;
    return {
        pick: function (midi) {
            var options = trombonePositions[midi];
            if (!options)
                return "";
            if (options.length === 1) {
                prev = options[0];
                return String(options[0]);
            }
            var candidates = options.slice();
            if (prev !== 6) {
                candidates = candidates.filter(function (c) { return c !== 7; });
                if (candidates.length === 0)
                    candidates = options.slice();
            }
            var choice;
            if (prev === null) {
                choice = candidates[0];
            } else {
                choice = candidates[0];
                for (var i = 1; i < candidates.length; i++) {
                    if (Math.abs(candidates[i] - prev) < Math.abs(choice - prev))
                        choice = candidates[i];
                }
            }
            prev = choice;
            return String(choice);
        }
    };
}

function griff_tuba(midi, breakLine) {
    var lb = breakLine ? "\n" : "";
    switch (midi) {
    case 30: return "1" + lb + "2" + lb + "3";
    case 31: return "1" + lb + "3";
    case 32: return "2" + lb + "3";
    case 33: return "1" + lb + "2";
    case 34: return "1";
    case 35: return "2";
    case 36: return "0";
    case 37: return "1" + lb + "2" + lb + "3";
    case 38: return "1" + lb + "3";
    case 39: return "2" + lb + "3";
    case 40: return "1" + lb + "2";
    case 41: return "1";
    case 42: return "2";
    case 43: return "0";
    case 44: return "2" + lb + "3";
    case 45: return "1" + lb + "2";
    case 46: return "1";
    case 47: return "2";
    case 48: return "0";
    case 49: return "1" + lb + "2";
    case 50: return "1";
    case 51: return "2";
    case 52: return "0";
    case 53: return "1";
    case 54: return "2";
    case 55: return "0";
    case 56: return "2" + lb + "3";
    case 57: return "1" + lb + "2";
    case 58: return "1";
    case 59: return "2";
    case 60: return "0";
    case 61: return "2";
    case 62: return "1";
    default: return "";
    }
}

function griff_tuba_onechar(midi) {
    switch (midi) {
    case 30: return "7";
    case 31: return "6";
    case 32: return "5";
    case 33: return "4";
    case 34: return "3";
    case 35: return "2";
    case 36: return "1";
    case 37: return "7";
    case 38: return "6";
    case 39: return "5";
    case 40: return "4";
    case 41: return "3";
    case 42: return "2";
    case 43: return "1";
    case 44: return "5";
    case 45: return "4";
    case 46: return "4";
    case 47: return "2";
    case 48: return "1";
    case 49: return "4";
    case 50: return "3";
    case 51: return "2";
    case 52: return "1";
    case 53: return "3";
    case 54: return "2";
    case 55: return "1";
    case 56: return "5";
    case 57: return "4";
    case 58: return "3";
    case 59: return "2";
    case 60: return "1";
    case 61: return "2";
    case 62: return "3";
    default: return "";
    }
}

function griff_euphonium(midi, breakLine) {
    var lb = breakLine ? "\n" : "";
    switch (midi) {
    case 42: return "1" + lb + "2" + lb + "3";
    case 43: return "1" + lb + "3";
    case 44: return "2" + lb + "3";
    case 45: return "1" + lb + "2";
    case 46: return "1";
    case 47: return "2";
    case 48: return "0";
    case 49: return "1" + lb + "2" + lb + "3";
    case 50: return "1" + lb + "3";
    case 51: return "2" + lb + "3";
    case 52: return "1" + lb + "2";
    case 53: return "1";
    case 54: return "2";
    case 55: return "0";
    case 56: return "2" + lb + "3";
    case 57: return "1" + lb + "2";
    case 58: return "1";
    case 59: return "2";
    case 60: return "0";
    case 61: return "1" + lb + "2";
    case 62: return "1";
    case 63: return "2";
    case 64: return "0";
    case 65: return "1";
    case 66: return "2";
    case 67: return "0";
    case 68: return "2" + lb + "3";
    case 69: return "1" + lb + "2";
    case 70: return "1";
    case 71: return "2";
    case 72: return "0";
    case 73: return "2";
    case 74: return "1";
    default: return "";
    }
}

function griff_euphonium_onechar(midi) {
    switch (midi) {
    case 42: return "7";
    case 43: return "6";
    case 44: return "5";
    case 45: return "4";
    case 46: return "3";
    case 47: return "2";
    case 48: return "1";
    case 49: return "7";
    case 50: return "6";
    case 51: return "5";
    case 52: return "4";
    case 53: return "3";
    case 54: return "2";
    case 55: return "1";
    case 56: return "5";
    case 57: return "4";
    case 58: return "3";
    case 59: return "2";
    case 60: return "1";
    case 61: return "4";
    case 62: return "3";
    case 63: return "2";
    case 64: return "1";
    case 65: return "3";
    case 66: return "2";
    case 67: return "1";
    case 68: return "5";
    case 69: return "4";
    case 70: return "3";
    case 71: return "2";
    case 72: return "1";
    case 73: return "2";
    case 74: return "3";
    default: return "";
    }
}
