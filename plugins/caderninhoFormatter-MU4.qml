import QtQuick 2.9
import QtQuick.Window 2.2
import QtQuick.Layouts 1.1
import QtQuick.Controls 2.15
import MuseScore 3.0

MuseScore {
    id: caderninhoFormatter
    version: "3.1"
    description: "Different options for formatting the score for carnival"
    pluginType: "dialog"
    dockArea: "left"
    menuPath: "Plugins.Caderninho Formatter"

    requiresScore: true
    width: 250
    height: mainCol.implicitHeight + 20

    property bool breakLine: false
    property bool addOffset: true
    property int noteShift: 0
    property bool verbose: true
    property int nPages: 1
    property variant minOffset: -1.0
    property variant multiNoteOffset: -2.3
    property variant pitchOffsetScale: -5.0
    property var textColor: ui.theme.isDark ? "#FFFFFF" : "#000000"
    property var instrumentList: ["Trumpet Bb", "Trumpet C", "Trombone", "Tuba", "Tuba Eb", "Euphonium"]
    property var valInstrument: "Trumpet Bb"
    property bool debugMode: false
    property string logText: ""
    property string locale: Qt.locale().name.startsWith("pt") ? "pt-br" : "en"
    property var translations: ({
            "en": {
                "applyAllParts": "Apply to all parts",
                "basicFormat": "Basic format:",
                "cleanFingering": "Clean fingering",
                "cleanTextBoxes": "Clean text boxes",
                "setStyle": "Set style",
                "adjustScale": "Adjust Scale",
                "leadingSpace": "Leading space",
                "addFingering": "Add fingering",
                "fingeringSize": "Fingering size",
                "manualAdjust": "Manual adjust:",
                "fingeringSizeLabel": "Fingering size:",
                "spatium": "Spatium:",
                "options": "Options:",
                "oneCharFingering": "Use one char fingering",
                "debugMode": "Debug log"
            },
            "pt-br": {
                "applyAllParts": "Aplicar em todas as partes",
                "basicFormat": "Formatação básica:",
                "cleanFingering": "Limpar piratas",
                "cleanTextBoxes": "Limpar caixas de texto",
                "setStyle": "Estilo de página de caderninho",
                "adjustScale": "Ajustar escala",
                "leadingSpace": "Espaço inicial",
                "addFingering": "Adicionar piratas",
                "fingeringSize": "Tamanho dos piratas",
                "manualAdjust": "Ajuste manual:",
                "fingeringSizeLabel": "Tamanho dos piratas:",
                "spatium": "Espaçamento:",
                "options": "Opções:",
                "oneCharFingering": "Pirata de número de posição",
                "debugMode": "Mostrar logs"
            }
        })

    function t(key) {
        return translations[locale][key] || translations["en"][key];
    }

    onScoreStateChanged: {
        if (state.selectionChanged && curScore) {
            fingeringFontSizeVal.value = curScore.style.value("fingeringFontSize");
            saptiumSizeVal.value = curScore.style.value("spatium");
        }
    }

    Column {
        id: mainCol
        anchors.top: parent.top
        anchors.topMargin: 10
        anchors.left: parent.left
        anchors.leftMargin: 10
        anchors.right: parent.right
        anchors.rightMargin: 10
        spacing: 10

        CheckBox {
            id: optAll
            checked: false

            Text {
                text: t("applyAllParts")
                color: textColor
                anchors.left: parent.right
                anchors.verticalCenter: parent.verticalCenter
            }
        }

        Text {
            font.bold: true
            text: t("basicFormat")
            color: textColor
        }

        GridLayout {
            width: parent.width
            columns: 2

            Text {
                text: "1."
                color: textColor
            }
            Button {
                Text {
                    anchors.fill: parent
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    color: textColor
                    text: t("cleanFingering")
                }
                Layout.fillWidth: true
                Layout.margins: 1
                onClicked: {
                    curScore.startCmd();
                    if (optAll.checked) {
                        forAllParts(cleanAllFingering);
                    } else {
                        cleanAllFingering(curScore);
                    }
                    curScore.endCmd();
                }
            }

            Text {
                text: "2."
                color: textColor
            }
            Button {
                Text {
                    anchors.fill: parent
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    color: textColor
                    text: t("cleanTextBoxes")
                }
                Layout.fillWidth: true
                Layout.margins: 1
                onClicked: {
                    cleanTextBox();
                }
            }

            Text {
                text: "3."
                color: textColor
            }
            Button {
                Text {
                    anchors.fill: parent
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    color: textColor
                    text: t("setStyle")
                }
                Layout.fillWidth: true
                Layout.margins: 1
                onClicked: {
                    curScore.startCmd();
                    if (optAll.checked) {
                        forAllParts(setStyle);
                    } else {
                        setStyle(curScore);
                    }
                    curScore.endCmd();
                }
            }

            Text {
                text: "4."
                color: textColor
            }
            Button {
                Text {
                    anchors.fill: parent
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    color: textColor
                    text: t("adjustScale")
                }
                Layout.fillWidth: true
                Layout.margins: 1
                onClicked: {
                    if (optAll.checked) {
                        forAllParts(adjustSpatium);
                    } else {
                        adjustSpatium(curScore);
                    }
                }
            }

            Text {
                text: "5."
                color: textColor
            }
            Button {
                Text {
                    anchors.fill: parent
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    color: textColor
                    text: t("leadingSpace")
                }
                Layout.fillWidth: true
                Layout.margins: 1
                onClicked: {
                    if (optAll.checked) {
                        forAllParts(adjustLeadingSpace);
                    } else {
                        adjustLeadingSpace(curScore);
                    }
                }
            }

            Text {
                text: "6."
                color: textColor
            }
            Button {
                Text {
                    anchors.fill: parent
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    color: textColor
                    text: t("addFingering")
                }
                Layout.fillWidth: true
                Layout.margins: 1
                onClicked: {
                    breakLine = false;
                    noteShift = 0;
                    curScore.startCmd();
                    if (optAll.checked) {
                        forAllParts(autoAddFingering);
                    } else {
                        autoAddFingering(curScore);
                    }
                    curScore.endCmd();
                }
            }

            Text {
                text: "7."
                color: textColor
            }
            Button {
                Text {
                    anchors.fill: parent
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    color: textColor
                    text: t("fingeringSize")
                }
                Layout.fillWidth: true
                Layout.margins: 1
                onClicked: {
                    breakLine = false;
                    noteShift = 0;
                    curScore.startCmd();
                    if (optAll.checked) {
                        forAllParts(adjustFingeringFontSize);
                    } else {
                        adjustFingeringFontSize(curScore);
                    }
                    curScore.endCmd();
                }
            }
        }

        Text {
            font.bold: true
            text: t("manualAdjust")
            color: textColor
        }

        GridLayout {
            width: parent.width
            columns: 2

            Text {
                text: t("fingeringSizeLabel")
                color: textColor
            }
            SpinBox {
                id: fingeringFontSizeVal
                from: 1
                to: 100
                value: curScore.style.value("fingeringFontSize")
                onValueChanged: {
                    setFingeringFontSize(curScore, fingeringFontSizeVal.value);
                }
            }

            Text {
                text: t("spatium")
                color: textColor
            }
            SpinBox {
                id: saptiumSizeVal
                from: 1
                to: 100
                value: curScore.style.value("spatium")
                onValueChanged: {
                    setSpatium(curScore, saptiumSizeVal.value);
                }
            }
        }

        Text {
            font.bold: true
            text: t("options")
            color: textColor
        }

        CheckBox {
            id: oneCharFingeringCheckbox
            checked: true

            Text {
                text: t("oneCharFingering")
                color: textColor
                anchors.left: parent.right
                anchors.verticalCenter: parent.verticalCenter
            }
        }

        CheckBox {
            id: debugModeCheckbox
            checked: debugMode
            onCheckedChanged: {
                debugMode = checked;
                if (!checked)
                    logText = "";
            }

            Text {
                text: t("debugMode")
                color: textColor
                anchors.left: parent.right
                anchors.verticalCenter: parent.verticalCenter
            }
        }

        Text {
            text: "v" + version
            color: textColor
            opacity: 0.5
            font.pixelSize: 11
        }
    }

    Window {
        id: debugWindow
        title: "Debug log"
        visible: debugMode
        width: 500
        height: 400
        flags: Qt.Window

        ScrollView {
            anchors.fill: parent
            clip: true

            TextArea {
                text: logText
                readOnly: true
                wrapMode: TextArea.Wrap
            }
        }
    }

    function cleanTextBox() {
        cmd('select-all');
        cmd('append-vbox');
        cmd('last-element');
        cmd('next-element');
        cmd('select-similar');
        cmd('delete');
    }

    function setStyle(score) {
        var style = score.style;
        score.startCmd();
        // A4 landscape
        style.setValue("pageWidth", 11.6902);
        style.setValue("pageHeight", 6.69291);
        style.setValue("pagePrintableWidth", 11.2965);
        style.setValue("staffLowerBorder", 4);

        // Margin - 5mm and 0 in bottom
        style.setValue("pageTwosided", true);
        style.setValue("pageOddLeftMargin", 0.19685039370078738);
        style.setValue("pageOddTopMargin", 0.19685039370078738);
        style.setValue("pageOddBottomMargin", 0);
        style.setValue("pageEvenLeftMargin", 0.19685039370078738);
        style.setValue("pageEvenTopMargin", 0.19685039370078738);
        style.setValue("midClefKeyRightMargin", 1);
        style.setValue("clefKeyRightMargin", 0.8);
        style.setValue("pageEvenBottomMargin", 0);
        style.setValue("enableIndentationOnFirstSystem", 0);
        score.endCmd();
    }

    function setFingeringFontSize(score, value) {
        var style = score.style;
        score.startCmd();
        style.setValue("fingeringFontSize", value);
        score.endCmd();
    }

    function adjustFingeringFontSize(score) {
        var style = score.style;
        var start = style.value("fingeringFontSize");
        var current = start;
        var min = 7;
        var step = 1;
        if (score.npages > 1) {
            while (score.npages > 1 && current >= min) {
                setFingeringFontSize(score, current - step);
                current -= step;
            }
        } else {
            while (score.npages <= 1) {
                setFingeringFontSize(score, current + step);
                current += step;
            }
            setFingeringFontSize(score, current + step);
            if (score.npages > 1)
                setFingeringFontSize(score, current - 2 * step);
        }
        fingeringFontSizeVal.value = style.value("fingeringFontSize");
    }

    function setSpatium(score, value) {
        var style = score.style;
        score.startCmd();
        style.setValue("spatium", value);
        score.endCmd();
    }

    function adjustSpatium(score) {
        var style = score.style;
        var start = style.value("spatium");
        var current = start;
        var step = 0.1;
        if (score.npages > 1) {
            while (score.npages > 1) {
                setSpatium(score, current - step);
                current -= step;
            }
        } else {
            while (score.npages <= 1) {
                setSpatium(score, current + step);
                current += step;
            }
            setSpatium(score, current - step);
        }
    }

    function setLeadingSpace(score, value) {
        var segment = score.firstSegment();
        score.startCmd();
        while (segment) {
            segment.leadingSpace = value;
            segment = segment.next;
        }
        score.endCmd();
    }

    function adjustLeadingSpace(score) {
        var start = 0.5;
        var current = start;
        var step = 0.05;
        setLeadingSpace(score, start);
        if (score.npages > 1) {
            while (score.npages > 1) {
                console.log("Reducing leading space");
                setLeadingSpace(score, current - step);
                current -= step;
            }
        } else {
            while (score.npages <= 1) {
                console.log("Increasing leading space");
                setLeadingSpace(score, current + step);
                current += step;
            }
            setLeadingSpace(score, current - step);
        }
    }

    function log(msg) {
        if (verbose) {
            if (debugMode)
                logText += msg + "\n";
            console.log(msg);
        }
    }

    function inspect(obj) {
        log(JSON.stringify(obj, null, 2));
    }

    function griff_trumpet(midi) {
        var lineBreak = breakLine ? "\n" : "";
        switch (midi) {
        case 34:
            return "1" + lineBreak + "2" + lineBreak + "3";
            break;
        case 35:
            return "1" + lineBreak + "3";
            break;
        case 36:
            return "2" + lineBreak + "3";
            break;
        case 37:
            return "1" + lineBreak + "2";
            break;
        case 38:
            return "1";
            break;
        case 39:
            return "2";
            break;
        case 40:
            return "0";
            break; //Bb Below Staff Treble
        case 41:
            return "1" + lineBreak + "2" + lineBreak + "3";
            break; //B
        case 42:
            return "1" + lineBreak + "3";
            break; //C
        case 43:
            return "2" + lineBreak + "3";
            break; //C#
        case 44:
            return "1" + lineBreak + "2";
            break; //D
        case 45:
            return "1";
            break; //Eb
        case 46:
            return "2";
            break; //E
        case 47:
            return "0";
            break; //F
        case 48:
            return "2" + lineBreak + "3";
            break; //F#
        case 49:
            return "1" + lineBreak + "2";
            break; //G
        case 50:
            return "1";
            break; //G#
        case 51:
            return "2";
            break; //A
        case 52:
            return "0";
            break; //Bb
        case 53:
            return "1" + lineBreak + "2";
            break;
        case 54:
            return "1";
            break;
        case 55:
            return "2";
            break;
        case 56:
            return "0";
            break;
        case 57:
            return "1";
            break;
        case 58:
            return "2";
            break;
        case 59:
            return "0";
            break;
        case 60:
            return "2" + lineBreak + "3";
            break;
        case 61:
            return "1" + lineBreak + "2";
            break;
        case 62:
            return "1";
            break;
        case 63:
            return "2";
            break;
        case 64:
            return "0";
            break;
        case 65:
            return "2";
            break;
        case 66:
            return "1";
            break;
        default:
            return "";
        }
    }

    function griff_trombone(midi) {
        switch (midi) {
        case 23:
            return "6";
            break;//F
        case 24:
            return "5";
            break;//Gb
        case 25:
            return "4";
            break;//G
        case 26:
            return "3";
            break;//Ab
        case 27:
            return "2";
            break;//A
        case 28:
            return "1";
            break;//Bb 2nd Line
        case 29:
            return "7";
            break;//B
        case 30:
            return "6";
            break;//C
        case 31:
            return "5";
            break;//Db
        case 32:
            return "4";
            break;//D
        case 33:
            return "3";
            break;//Eb
        case 34:
            return "2";
            break;//E
        case 35:
            return "1";
            break;//F
        case 36:
            return "5";
            break;//Gb
        case 37:
            return "4";
            break;//G
        case 38:
            return "3";
            break;//Ab
        case 39:
            return "2";
            break;//A
        case 40:
            return "1";
            break;//Bb Top Staff Bass
        case 41:
            return "4";
            break;//B
        case 42:
            return "3";
            break;//C
        case 43:
            return "2";
            break;//C#
        case 44:
            return "1";
            break;//D
        case 45:
            return "3";
            break;
        case 46:
            return "2";
            break;
        case 47:
            return "1";
            break;
        case 48:
            return "3";
            break;
        case 49:
            return "2";
            break;
        case 50:
            return "3";
            break;
        case 51:
            return "1";
            break;//Bb Above Staff Bass
        default:
            return "";
        }
    }

    function griff_tuba(midi) {
        var lineBreak = breakLine ? "\n" : "";
        switch (midi) {
        case 10:
            return "1" + lineBreak + "2" + lineBreak + "3";
            break;
        case 11:
            return "1" + lineBreak + "3";
            break;
        case 12:
            return "2" + lineBreak + "3";
            break;
        case 13:
            return "1" + lineBreak + "2";
            break;
        case 14:
            return "1";
            break;
        case 15:
            return "2";
            break;
        case 16:
            return "0";
            break; //Bb below staff
        case 17:
            return "1" + lineBreak + "2" + lineBreak + "3";
            break; //B
        case 18:
            return "1" + lineBreak + "3";
            break; //C
        case 19:
            return "2" + lineBreak + "3";
            break; //C#
        case 20:
            return "1" + lineBreak + "2";
            break; //D
        case 21:
            return "1";
            break; //Eb
        case 22:
            return "2";
            break; //E
        case 23:
            return "0";
            break; //F
        case 24:
            return "2" + lineBreak + "3";
            break; //F#
        case 25:
            return "1" + lineBreak + "2";
            break; //G
        case 26:
            return "1";
            break; //G#
        case 27:
            return "2";
            break; //A
        case 28:
            return "0";
            break; //Bb 2nd line
        case 29:
            return "1" + lineBreak + "2";
            break;
        case 30:
            return "1";
            break;
        case 31:
            return "2";
            break;
        case 32:
            return "0";
            break;
        case 33:
            return "1";
            break;
        case 34:
            return "2";
            break;
        case 35:
            return "0";
            break;
        case 36:
            return "2" + lineBreak + "3";
        case 37:
            return "1" + lineBreak + "2";
        case 38:
            return "1";
        case 39:
            return "2";
        case 40:
            return "0";
        case 41:
            return "2";
        case 42:
            return "1";
        default:
            return "";
        }
    }

    function griff_tuba_onechar(midi) {
        var lineBreak = breakLine ? "\n" : "";
        switch (midi) {
        case 10:
            return "7";
        case 11:
            return "6";
        case 12:
            return "5";
        case 13:
            return "4";
        case 14:
            return "3";
        case 15:
            return "2";
        case 16:
            return "1"; //Bb below staff
        case 17:
            return "7"; //B
        case 18:
            return "6"; //C
        case 19:
            return "5"; //C#
        case 20:
            return "4"; //D
        case 21:
            return "3"; //Eb
        case 22:
            return "2"; //E
        case 23:
            return "1"; //F
        case 24:
            return "5"; //F#
        case 25:
            return "4"; //G
        case 26:
            return "4"; //G#
        case 27:
            return "2"; //A
        case 28:
            return "1"; //Bb 2nd line
        case 29:
            return "4";
        case 30:
            return "3";
        case 31:
            return "2";
        case 32:
            return "1";
        case 33:
            return "3";
        case 34:
            return "2";
        case 35:
            return "1";
        case 36:
            return "5";
        case 37:
            return "4";
        case 38:
            return "3";
        case 39:
            return "2";
        case 40:
            return "1";
        case 41:
            return "2";
        case 42:
            return "3";
        default:
            return "";
        }
    }

    function griff_euphonium(midi) {
        var lineBreak = breakLine ? "\n" : "";
        switch (midi) {
        case 22:
            return "1" + lineBreak + "2" + lineBreak + "3";
            break;
        case 23:
            return "1" + lineBreak + "3";
            break;
        case 24:
            return "2" + lineBreak + "3";
            break;
        case 25:
            return "1" + lineBreak + "2";
            break;
        case 26:
            return "1";
            break;
        case 27:
            return "2";
            break;
        case 28:
            return "0";
            break; //Bb 2nd Line
        case 29:
            return "1" + lineBreak + "2" + lineBreak + "3";
            break; //B
        case 30:
            return "1" + lineBreak + "3";
            break; //C
        case 31:
            return "2" + lineBreak + "3";
            break; //C#
        case 32:
            return "1" + lineBreak + "2";
            break; //D
        case 33:
            return "1";
            break; //Eb
        case 34:
            return "2";
            break; //E
        case 35:
            return "0";
            break; //F
        case 36:
            return "2" + lineBreak + "3";
            break; //F#
        case 37:
            return "1" + lineBreak + "2";
            break; //G
        case 38:
            return "1";
            break; //G#
        case 39:
            return "2";
            break; //A
        case 40:
            return "0";
            break; //Bb
        case 41:
            return "1" + lineBreak + "2";
            break;
        case 42:
            return "1";
            break;
        case 43:
            return "2";
            break;
        case 44:
            return "0";
            break;
        case 45:
            return "1";
            break;
        case 46:
            return "2";
            break;
        case 47:
            return "0";
            break;
        case 48:
            return "2" + lineBreak + "3";
            break;
        case 49:
            return "1" + lineBreak + "2";
            break;
        case 50:
            return "1";
            break;
        case 51:
            return "2";
            break;
        case 52:
            return "0";
            break;
        case 53:
            return "2";
            break;
        case 54:
            return "1";
            break;
        default:
            return "";
        }
    }

    function griff_euphonium_onechar(midi) {
        var lineBreak = breakLine ? "\n" : "";
        switch (midi) {
        case 22:
            return "7";
            break;
        case 23:
            return "6";
            break;
        case 24:
            return "5";
            break;
        case 25:
            return "4";
            break;
        case 26:
            return "3";
            break;
        case 27:
            return "2";
            break;
        case 28:
            return "1";
            break; //Bb 2nd Line
        case 29:
            return "7";
            break; //B
        case 30:
            return "6";
            break; //C
        case 31:
            return "5";
            break; //C#
        case 32:
            return "4";
            break; //D
        case 33:
            return "3";
            break; //Eb
        case 34:
            return "2";
            break; //E
        case 35:
            return "1";
            break; //F
        case 36:
            return "5";
            break; //F#
        case 37:
            return "4";
            break; //G
        case 38:
            return "3";
            break; //G#
        case 39:
            return "2";
            break; //A
        case 40:
            return "1";
            break; //Bb
        case 41:
            return "4";
            break;
        case 42:
            return "3";
            break;
        case 43:
            return "2";
            break;
        case 44:
            return "1";
            break;
        case 45:
            return "3";
            break;
        case 46:
            return "2";
            break;
        case 47:
            return "1";
            break;
        case 48:
            return "5";
            break;
        case 49:
            return "4";
            break;
        case 50:
            return "3";
            break;
        case 51:
            return "2";
            break;
        case 52:
            return "1";
            break;
        case 53:
            return "2";
            break;
        case 54:
            return "3";
            break;
        default:
            return "";
        }
    }

    function griff(midi, oneChar) {
        midi = midi - 20 + noteShift;
        switch (valInstrument) {
        case "Trumpet Bb":
            return griff_trumpet(midi + 2);
        case "Trumpet C":
            return griff_trumpet(midi);
        case "Trombone":
            return griff_trombone(midi + 2);
        case "Tuba":
            return oneChar ? griff_tuba_onechar(midi + 2) : griff_tuba(midi + 2);
        case "Tuba Eb":
            return oneChar ? griff_tuba_onechar(midi - 3) : griff_tuba(midi - 3);
        case "Euphonium":
            return oneChar ? griff_euphonium_onechar(midi + 2) : griff_euphonium(midi + 2);
        default:
            return "";
        }
    }

    function listProperty(item) {
        for (var p in item) {
            if (typeof item[p] != "function")
                if (p != "objectName")
                    console.error(p + ":" + item[p]);
        }
    }

    function forAllParts(callback) {
        for (var i = 0; i < curScore.excerpts.length; i++) {
            var score = curScore.excerpts[i].partScore;
            if (score)
                callback(score);
        }
    }

    function cleanAllFingering(score) {
        var cursor = score.newCursor();
        var partsNum = cursor.score.parts.length;
        log("Cleaning " + partsNum + " parts");
        for (var i = 0; i < partsNum; i++) {
            var startTrack = cursor.score.parts[i].startTrack;
            var endTrack = cursor.score.parts[i].endTrack;
            for (var j = 0; j < (endTrack - startTrack) / 4; j++) {
                cleanFingering(score, startTrack / 4 + j);
            }
        }
    }

    function cleanFingering(score, staff) {
        var cursor = score.newCursor();
        var staffIdx = staff != null ? staff : cursor.score.selection.startStaff;
        log("Cleaning staffIdx " + staffIdx);
        cursor.staffIdx = staffIdx;
        cursor.rewind(0);
        while (cursor.segment) {
            if (cursor.element && cursor.element.type == Element.CHORD && cursor.element.notes[0].elements) {
                var elements = cursor.element.notes[0].elements;
                for (var i = 0; i < elements.length; i++) {
                    if (elements[i].type == Element.FINGERING) {
                        removeElement(elements[i]);
                    }
                }
            }

            if (cursor.segment.annotations) {
                for (var i = 0; i < cursor.segment.annotations.length; i++) {
                    var annotation = cursor.segment.annotations[i];
                    if (annotation.type === Element.STAFF_TEXT) {
                        removeElement(annotation);
                    }
                }
            }
            cursor.next();
        }
    }

    function hasEbInPartName(part) {
        return part && part.longName && (part.partName.indexOf("Eb") > -1 || part.partName.indexOf("E♭") > -1 || part.longName.indexOf("Eb") > -1 || part.longName.indexOf("E♭") > -1 || part.shortName.indexOf("Eb") > -1 || part.shortName.indexOf("E♭") > -1);
    }

    function autoAddFingering(score) {
        var cursor = score.newCursor();
        var partsNum = cursor.score.parts.length;
        log("Adding fingering for " + partsNum + " parts");

        for (var i = 0; i < partsNum; i++) {
            const part = cursor.score.parts[i];
            const startTrack = part.startTrack;
            const endTrack = part.endTrack;
            const instrumentId = part.instrumentId;

            log("Part " + i + " - tracks " + startTrack + " to " + endTrack + ". Instrument ID: " + instrumentId);

            for (var j = 0; j < (endTrack - startTrack) / 4; j++) {
                var staffIdx = startTrack / 4 + j;
                var onechar = oneCharFingeringCheckbox.checked;
                switch (instrumentId) {
                case "brass.trombone":
                case "trombone":
                case "brass.trombone.tenor":
                    valInstrument = "Trombone";
                    break;
                case "bb-tuba":
                    valInstrument = "Tuba";
                    break;
                case "brass.tuba":
                case "tuba":
                    valInstrument = hasEbInPartName(part) ? "Tuba Eb" : "Tuba";
                    break;
                case "bass-eb-tuba":
                    valInstrument = "Tuba Eb";
                    break;
                case "trumpet":
                case "bb-trumpet":
                case "brass.trumpet.bflat":
                case "brass.trumpet":
                    valInstrument = "Trumpet Bb";
                    break;
                case "euphonium-treble":
                case "brass.euphonium":
                case "euphonium":
                    valInstrument = "Euphonium";
                    break;
                case "c-trumpet":
                    valInstrument = "Trumpet C";
                    break;
                default:
                    continue;
                }
                log("valInstrument: " + valInstrument + "; oneChar: " + onechar);
                addFingering(score, staffIdx, onechar);
            }
        }
    }

    function scoreExtremes(score, staffIdx) {
        var cursor = score.newCursor();
        cursor.staffIdx = staffIdx;
        var minPitch = 84;
        var maxPitch = 26;
        cursor.rewind(0);
        while (cursor.segment) {
            if (cursor.element.notes && cursor.element.notes.length > 0) {
                var pitch = cursor.element.notes[0].pitch;
                minPitch = pitch < minPitch ? pitch : minPitch;
                maxPitch = pitch > maxPitch ? pitch : maxPitch;
            }
            cursor.next();
        }
        return [minPitch, maxPitch];
    }

    function getNotePitchOffset(cursor, pitch, minPitch, maxPitch) {
        return minOffset + (cursor.element.notes.length - 1) * multiNoteOffset + (pitch - minPitch) / (maxPitch - minPitch) * pitchOffsetScale;
    }

    function addFingering(score, staffIdx, onechar) {
        var cursor = score.newCursor();
        var staff = staffIdx != null ? staffIdx : cursor.score.selection.startStaff;
        var extremes = scoreExtremes(score, staffIdx);
        var minPitch = extremes[0];
        var maxPitch = extremes[1];
        log("Adding fingering for staff " + staff + ". Pitch min/max: " + minPitch + "/" + maxPitch);
        cursor.staffIdx = staff;
        cleanFingering(score, staff);
        cursor.rewind(0);
        while (cursor.segment) {
            if (cursor.element && cursor.element.type == Element.CHORD) {
                var fingering = newElement(Element.FINGERING);
                var note = cursor.element.notes[0];
                var pitchOffset = getNotePitchOffset(cursor, note.pitch, minPitch, maxPitch);
                fingering.text = griff(note.pitch, onechar);
                fingering.offsetY = pitchOffset;
                if (note.tieBack == null && fingering.text != "")
                    cursor.add(fingering);
                if (cursor.element.stem)
                    cursor.element.stem.stemDirection = 2;
            }
            cursor.next();
        }
    }
}
