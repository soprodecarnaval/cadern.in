import QtQuick 2.9
import QtQuick.Window 2.2
import QtQuick.Layouts 1.1
import QtQuick.Controls 2.15
import Qt.labs.platform 1.0 as Platform
import "translations.js" as I18n
import "caderninInstruments.js" as CaderninInstruments
import "fileUtils.js" as FileUtils

Window {
    id: exportWindow

    property var logFn: function (msg) {
        console.log(msg);
    }
    property string locale: "en"

    function t(key) {
        return I18n.t(locale, key);
    }

    title: t("exportWindowTitle")
    width: 560
    height: 540
    minimumWidth: 460
    minimumHeight: 400
    flags: Qt.Window

    SystemPalette {
        id: systemPalette
        colorGroup: SystemPalette.Active
    }
    property var textColor: systemPalette.windowText
    property var errorColor: "#CC3333"
    property var successColor: "#226622"

    property var exportPartsData: []
    property string exportResultPath: ""

    function isExportSupported() {
        var parts = Qt.application.version.split(".");
        return parseInt(parts[0]) > 4 || (parseInt(parts[0]) === 4 && parseInt(parts[1]) >= 7);
    }

    function populateExportParts() {
        exportResultPath = "";
        logFn("[export] populateExportParts called");
        logFn("[export] darkMode: " + ui.theme.isDark);
        if (!curScore) {
            logFn("[export] no curScore, aborting");
            return;
        }
        logFn("[export] excerpts.length = " + curScore.excerpts.length);
        var parts = [];
        for (var i = 0; i < curScore.excerpts.length; i++) {
            var excerpt = curScore.excerpts[i];
            var partScore = excerpt.partScore;
            logFn("[export] excerpt " + i + ": title=" + excerpt.title + " partScore=" + partScore);
            if (!partScore) {
                logFn("[export] skipping excerpt " + i + ": no partScore");
                continue;
            }
            logFn("[export] partScore.parts.length = " + partScore.parts.length);
            var part = partScore.parts.length > 0 ? partScore.parts[0] : null;
            var instrumentId = part ? part.instrumentId : "(no part)";
            var longName = part ? part.longName : "(no part)";
            var instrument = part ? CaderninInstruments.getCaderninhoInstrument(part.instrumentId, part) : null;
            var name = excerpt.title || longName || ("Part " + (i + 1));
            logFn("[export] excerpt " + i + ": instrumentId=" + instrumentId + " longName=" + longName + " -> instrument=" + instrument + " name=" + name);
            parts.push({
                name: name,
                instrument: instrument || "",
                pages: partScore.npages,
                compatible: instrument !== null,
                checked: instrument !== null,
                excerptIndex: i
            });
        }
        logFn("[export] built " + parts.length + " parts");
        exportPartsData = parts;
        var titleVal = curScore.metaTag("workTitle");
        var composerVal = curScore.metaTag("composer");
        var subVal = curScore.metaTag("source");
        var tagsVal = curScore.metaTag("lyricist");
        logFn("[export] metadata: title=" + titleVal + " composer=" + composerVal + " sub=" + subVal + " tags=" + tagsVal);
        fieldTitle.text = titleVal || "";
        fieldComposer.text = composerVal || "";
        fieldSub.text = subVal || "";
        fieldTags.text = tagsVal || "";
    }

    onVisibleChanged: {
        logFn("[export] onVisibleChanged");
        if (visible && curScore) {
            populateExportParts();
        }
    }

    Platform.FolderDialog {
        id: folderDialog
        title: t("exportWindowTitle")
        folder: (curScore && curScore.path) ? ("file://" + FileUtils.dirFromPath(curScore.path)) : ""
        onAccepted: startExport(folder)
    }

    function startExport(folderUrl) {
        logFn("[export] startExport called, folderUrl=" + folderUrl);
        if (!curScore) {
            logFn("[export] no curScore, aborting");
            return;
        }

        logFn("[export] saving metadata to score");
        curScore.startCmd();
        curScore.setMetaTag("workTitle", fieldTitle.text);
        curScore.setMetaTag("composer", fieldComposer.text);
        curScore.setMetaTag("source", fieldSub.text);
        curScore.setMetaTag("lyricist", fieldTags.text);
        curScore.endCmd();

        var folder = folderUrl.toString().replace(/^file:\/\//, "");
        var sanitized = FileUtils.sanitizeName(fieldTitle.text) || "score";
        var dest = folder + "/" + sanitized;
        logFn("[export] dest=" + dest);

        logFn("[export] writing mscz to " + dest + "/" + sanitized + ".mscz");
        var msczResult = writeScore(curScore, dest + "/" + sanitized, "mscz");
        logFn("[export] writeScore mscz result=" + msczResult);

        logFn("[export] writing metajson");
        FileUtils.writeJsonFile(dest + "/" + sanitized + ".metajson", {
            composer: fieldComposer.text,
            previousSource: fieldSub.text,
            poet: fieldTags.text
        });

        var exported = 0;
        for (var i = 0; i < exportPartsData.length; i++) {
            var item = exportPartsData[i];
            if (!item.compatible || !item.checked) {
                logFn("[export] skipping part " + item.name + " (compatible=" + item.compatible + " checked=" + item.checked + ")");
                continue;
            }
            var partScore = curScore.excerpts[item.excerptIndex].partScore;
            var partName = FileUtils.sanitizeName(item.name);
            var basePath = dest + "/" + sanitized + "-" + partName;
            logFn("[export] exporting part " + item.name + " to " + basePath);

            var midiResult = writeScore(partScore, basePath, "midi");
            logFn("[export] writeScore midi result=" + midiResult);

            var svgResult = writeScore(partScore, basePath, "svg");
            logFn("[export] writeScore svg result=" + svgResult);

            exported++;
        }

        logFn("[export] done, exported " + exported + " parts to " + dest);
        exportResultPath = dest;
    }

    ScrollView {
        anchors.fill: parent
        clip: true
        contentWidth: availableWidth

        Rectangle {
            anchors.fill: parent
            anchors.margins: 16
            color: systemPalette.window

            Column {
                width: exportWindow.width - 32
                spacing: 12

                Text {
                    font.bold: true
                    text: t("partsSection")
                    color: textColor
                }

                Text {
                    visible: !curScore || curScore.excerpts.length === 0
                    text: t("noExcerptsWarning")
                    color: errorColor
                    wrapMode: Text.WordWrap
                    width: parent.width
                }

                Repeater {
                    model: exportPartsData

                    RowLayout {
                        width: exportWindow.width - 32
                        spacing: 8
                        opacity: modelData.compatible ? 1.0 : 0.45

                        CheckBox {
                            checked: modelData.checked
                            enabled: modelData.compatible
                            onToggled: {
                                var updated = exportPartsData.slice();
                                updated[index] = {
                                    name: modelData.name,
                                    instrument: modelData.instrument,
                                    pages: modelData.pages,
                                    compatible: modelData.compatible,
                                    checked: checked,
                                    excerptIndex: modelData.excerptIndex
                                };
                                exportPartsData = updated;
                            }
                        }

                        Text {
                            text: modelData.name
                            color: textColor
                            Layout.fillWidth: true
                            elide: Text.ElideRight
                        }

                        Text {
                            text: modelData.pages + " p."
                            color: textColor
                            opacity: 0.7
                            font.pixelSize: 11
                        }

                        Text {
                            text: modelData.instrument || "—"
                            color: textColor
                            opacity: 0.7
                            font.pixelSize: 11
                            font.italic: !modelData.compatible
                        }
                    }
                }

                Item {
                    height: 4
                }

                Text {
                    font.bold: true
                    text: t("metadataSection")
                    color: textColor
                }

                GridLayout {
                    width: parent.width
                    columns: 2
                    columnSpacing: 8
                    rowSpacing: 4

                    Text {
                        text: t("titleLabel")
                        color: textColor
                    }
                    TextField {
                        id: fieldTitle
                        Layout.fillWidth: true
                        onEditingFinished: {
                            if (!curScore)
                                return;
                            curScore.startCmd();
                            curScore.setMetaTag("workTitle", text);
                            curScore.endCmd();
                        }
                    }

                    Text {
                        text: t("composerLabel")
                        color: textColor
                    }
                    TextField {
                        id: fieldComposer
                        Layout.fillWidth: true
                        onEditingFinished: {
                            if (!curScore)
                                return;
                            curScore.startCmd();
                            curScore.setMetaTag("composer", text);
                            curScore.endCmd();
                        }
                    }

                    Text {
                        text: t("trechoLabel")
                        color: textColor
                    }
                    TextField {
                        id: fieldSub
                        Layout.fillWidth: true
                        onEditingFinished: {
                            if (!curScore)
                                return;
                            curScore.startCmd();
                            curScore.setMetaTag("source", text);
                            curScore.endCmd();
                        }
                    }

                    Text {
                        text: t("tagsLabel")
                        color: textColor
                    }
                    TextField {
                        id: fieldTags
                        Layout.fillWidth: true
                        onEditingFinished: {
                            if (!curScore)
                                return;
                            curScore.startCmd();
                            curScore.setMetaTag("lyricist", text);
                            curScore.endCmd();
                        }
                    }
                }

                Item {
                    height: 4
                }

                Text {
                    visible: !isExportSupported()
                    text: t("exportVersionError")
                    color: errorColor
                }

                Text {
                    visible: exportResultPath !== ""
                    text: t("exportSuccess") + " " + exportResultPath
                    color: successColor
                    wrapMode: Text.WordWrap
                    width: parent.width
                    font.pixelSize: 11
                }

                Button {
                    width: parent.width
                    enabled: isExportSupported() && curScore && curScore.excerpts.length > 0
                    Text {
                        anchors.fill: parent
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        color: textColor
                        text: t("exportBtn")
                    }
                    onClicked: folderDialog.open()
                }
            }
        }
    }
}
