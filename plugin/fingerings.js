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
