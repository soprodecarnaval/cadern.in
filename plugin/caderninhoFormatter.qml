import QtQuick 2.9
import QtQuick.Window 2.2
import QtQuick.Layouts 1.1
import QtQuick.Controls 2.15
import MuseScore 3.0
import "translations.js" as I18n
import "musescoreInstruments.js" as MsInstruments

MuseScore {
    id: caderninhoFormatter
    version: "3.3.1"
    description: "Different options for formatting the score for carnival"
    pluginType: "dialog"
    dockArea: "left"
    menuPath: "Plugins.Caderninho Formatter"

    requiresScore: true
    width: 250
    height: mainCol.implicitHeight + 20

    property bool breakLine: false
    property bool addOffset: true
    property bool verbose: true
    property int nPages: 1
    property variant minOffset: -1.0
    property variant multiNoteOffset: -2.3
    property variant pitchOffsetScale: -5.0
    property bool debugMode: false
    property string logText: ""
    property string locale: Qt.locale().name.startsWith("pt") ? "pt-br" : "en"

    function t(key) {
        return I18n.t(locale, key);
    }

    SystemPalette {
        id: systemPalette
        colorGroup: SystemPalette.Active
    }
    property var textColor: systemPalette.windowText

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
                onClicked: cleanTextBox()
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
                    curScore.startCmd();
                    if (optAll.checked) {
                        forAllParts(griffScore);
                    } else {
                        griffScore(curScore);
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
                onValueChanged: setFingeringFontSize(curScore, fingeringFontSizeVal.value)
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
                onValueChanged: setSpatium(curScore, saptiumSizeVal.value)
            }
        }

        Text {
            font.bold: true
            text: t("options")
            color: textColor
        }

        CheckBox {
            id: oneCharFingeringCheckbox
            checked: false

            Text {
                text: t("oneCharFingering")
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

    function log(msg) {
        if (verbose) {
            logText += msg + "\n";
            console.log(msg);
        }
    }

    function inspect(obj) {
        log(JSON.stringify(obj, null, 2));
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
        score.startCmd();
        score.style.setValue("fingeringFontSize", value);
        score.endCmd();
    }

    function adjustFingeringFontSize(score) {
        var style = score.style;
        var current = style.value("fingeringFontSize");
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
        score.startCmd();
        score.style.setValue("spatium", value);
        score.endCmd();
    }

    function adjustSpatium(score) {
        var current = score.style.value("spatium");
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
        var current = 0.5;
        var step = 0.05;
        setLeadingSpace(score, current);
        if (score.npages > 1) {
            while (score.npages > 1) {
                setLeadingSpace(score, current - step);
                current -= step;
            }
        } else {
            while (score.npages <= 1) {
                setLeadingSpace(score, current + step);
                current += step;
            }
            setLeadingSpace(score, current - step);
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
            for (var j = 0; j < (endTrack - startTrack) / 4; j++)
                cleanFingering(score, startTrack / 4 + j);
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
                    if (elements[i].type == Element.FINGERING)
                        removeElement(elements[i]);
                }
            }
            if (cursor.segment.annotations) {
                for (var i = 0; i < cursor.segment.annotations.length; i++) {
                    var annotation = cursor.segment.annotations[i];
                    if (annotation.type === Element.STAFF_TEXT)
                        removeElement(annotation);
                }
            }
            cursor.next();
        }
    }

    function griffScore(score) {
        var cursor = score.newCursor();
        var partsNum = cursor.score.parts.length;
        var oneChar = oneCharFingeringCheckbox.checked;
        log("Adding fingering for " + partsNum + " parts");
        for (var i = 0; i < partsNum; i++) {
            var part = cursor.score.parts[i];
            var startTrack = part.startTrack;
            var endTrack = part.endTrack;
            var instrumentId = part.instrumentId;
            log("Part " + i + " - tracks " + startTrack + " to " + endTrack + ". Instrument ID: " + instrumentId);
            for (var j = 0; j < (endTrack - startTrack) / 4; j++) {
                var staffIdx = startTrack / 4 + j;
                var fn = MsInstruments.getGriffFn(instrumentId, part, oneChar, breakLine);
                if (!fn)
                    continue;
                log("instrumentId: " + instrumentId + "; oneChar: " + oneChar);
                griffStaff(score, staffIdx, fn);
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

    function griffStaff(score, staffIdx, griffFn) {
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
                fingering.text = griffFn(note.pitch);
                fingering.offsetY = pitchOffset;
                if (note.tieBack == null && fingering.text != "")
                    cursor.add(fingering);
                if (cursor.element.stem)
                    cursor.element.stem.stemDirection = 2;
            }
            cursor.next();
        }
    }

    function listProperty(item) {
        for (var p in item) {
            if (typeof item[p] != "function" && p != "objectName")
                console.error(p + ":" + item[p]);
        }
    }
}
