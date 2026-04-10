import SVGtoPDF from "svg-to-pdfkit";
import { Instrument, Part, ScoreViewModel } from "../types";
import { Section } from "./tsx/PdfGenerator";
import { extractPartLabel } from "./instrument";

// Needed for calling PDFDocument from window variable
declare const window: any;

const cm2pt = 28.3465;

// A5 page dimensions in points
const pageWidth = 18 * cm2pt;
const pageHeight = 13 * cm2pt;

// TODO: use SongBook type instead of CreateSongBookOptions
export interface CreateSongBookOptions {
  title: string;
  instrument: Instrument;
  fallbackInstrument?: Instrument;
  sections: Section[];
  coverImageUrl: string;
  backSheetPageNumber: boolean;
  carnivalMode: boolean;
  antiAssedioPages: boolean;
  stripInstrumentFromPartLabel: boolean;
  debugBoundingBoxes?: boolean;
}

const fitText = (
  doc: any,
  text: string,
  font: string,
  maxFontSize: number,
  minFontSize: number,
  maxWidth: number,
): number => {
  for (let size = maxFontSize; size >= minFontSize; size--) {
    doc.font(font).fontSize(size);
    if (doc.widthOfString(text) <= maxWidth) return size;
  }
  return minFontSize;
};

const debugRect = (
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  debug: boolean,
) => {
  if (!debug) return;
  doc.save().rect(x, y, w, h).strokeColor(color).stroke().restore();
};

export const createSongBook = async (opts: CreateSongBookOptions) => {
  const doc = createDoc();
  await loadFonts(doc);

  const { title, instrument, sections, coverImageUrl, carnivalMode } = opts;
  let pageNumber = 0;
  let promises: Promise<any>[] = [];

  if (coverImageUrl != "") {
    promises.push(drawImage(doc, coverImageUrl, 0));
    doc
      .fontSize(25)
      .text(title.toUpperCase(), 120, 100)
      .fontSize(22)
      .text(instrument.toUpperCase(), 120, 125);
  } else if (carnivalMode) {
    promises.push(
      drawImage(
        doc,
        `assets/capa_carnaval_2026_${instrument.replace(/[ ]/g, "_")}.png`,
        pageNumber,
      ),
    );

    // doc
    //   .font("Roboto-Medium")
    //   .fontSize(14)
    //   // .rect(142, 213, 220, 15)
    //   // .fill("red")
    //   .text(instrument.toUpperCase(), 142, 203, {
    //     width: 220,
    //     align: "center",
    //   });

    doc.addPage();
    pageNumber++;
  } else {
    doc
      .fontSize(25)
      .text(title.toUpperCase(), 120, 100)
      .fontSize(22)
      .text(instrument.toUpperCase(), 120, 125);
  }

  pageNumber += addIndexPage(doc, opts);

  if (opts.antiAssedioPages) {
    const addBlank = opts.backSheetPageNumber;

    doc.addPage();
    pageNumber++;
    promises.push(drawImage(doc, "assets/anti_assedio_2026_1.png", pageNumber));

    if (addBlank) {
      doc.addPage();
      pageNumber++;
    }

    doc.addPage();
    pageNumber++;
    promises.push(drawImage(doc, "assets/anti_assedio_2026_2.png", pageNumber));

    if (addBlank) {
      doc.addPage();
      pageNumber++;
    }

    doc.addPage();
    pageNumber++;
    promises.push(drawImage(doc, "assets/anti_assedio_2026_3.png", pageNumber));

    if (addBlank) {
      doc.addPage();
      pageNumber++;
    }

    doc.addPage();
    pageNumber++;
    promises.push(drawImage(doc, "assets/anti_assedio_2026_4.png", pageNumber));
  }

  const { outline } = doc;

  let songPageIndex = 1;
  for (const { title, scores } of sections) {
    let topItem = outline.addItem(title.toUpperCase());
    sectionTitleOutlines.set(title, topItem);

    for (const score of scores) {
      // Get all parts for the current instrument, with optional fallback
      let partsForInstrument =
        score.parts?.filter((p) => p.instrument === instrument) ?? [];

      if (partsForInstrument.length === 0 && opts.fallbackInstrument) {
        partsForInstrument =
          score.parts?.filter((p) => p.instrument === opts.fallbackInstrument) ??
          [];
      }

      if (partsForInstrument.length > 0) {
        const isMultiPart = partsForInstrument.length > 1;

        for (let partIdx = 0; partIdx < partsForInstrument.length; partIdx++) {
          const part = partsForInstrument[partIdx];
          const partLabel = isMultiPart
            ? extractPartLabel(
                part.name,
                score.title,
                opts.stripInstrumentFromPartLabel,
              )
            : undefined;
          const displayNumber = isMultiPart
            ? `${songPageIndex}.${partIdx + 1}`
            : `${songPageIndex}`;
          const destId = isMultiPart ? `${score.id}_${partIdx}` : score.id;

          const [pageCount, addSongPagePromises] = await addSongPage(
            doc,
            score,
            part,
            pageNumber,
            songPageIndex,
            displayNumber,
            partLabel,
            destId,
            title,
            opts,
          );
          pageNumber += pageCount;
          promises.push(...addSongPagePromises);
        }
      }
      // Always advance the index number for consistent numbering
      songPageIndex++;
    }
  }
  const nonNullPromises = promises.filter((promise) => promise !== null);
  if (nonNullPromises.length > 0) {
    await Promise.all(nonNullPromises);
    download(doc, createFileName(opts));
  }
};

let sectionTitleOutlines = new Map();

const a = document.createElement("a");
document.body.appendChild(a);

const download = (doc: any, file_name: string) => {
  const stream = doc.pipe(window.blobStream());
  stream.on("finish", function () {
    const url = stream.toBlobURL("application/pdf");
    a.href = url;
    a.download = file_name;
    a.click();
    window.URL.revokeObjectURL(url);
  });
  doc.end();
};

const drawSvg = async (doc: any, url: string, page: number): Promise<void> => {
  try {
    const resp = await fetch(url);
    const svg = await resp.text();
    doc.switchToPage(page);
    const width = 17.17 * cm2pt;
    const height = 9.82 * cm2pt;
    SVGtoPDF(doc, svg, 0.44 * cm2pt, 2.55 * cm2pt, {
      width: width,
      height: height,
      preserveAspectRatio: `${width}x${height}`,
    });
  } catch (e) {
    console.error(e);
  }
};

const loadImage = (url: string) => {
  return new Promise((resolve, reject) => {
    let img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      // resolve(img)
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.height = img.naturalHeight;
      canvas.width = img.naturalWidth;
      ctx?.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL();
      resolve(dataUrl);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image's URL: ${url}`));
    };
    img.src = url;
  });
};

const drawImage = (
  doc: any,
  imageUrl: any,
  pageNumber: number,
): Promise<void> => {
  return loadImage(imageUrl).then((img: any) => {
    doc.switchToPage(pageNumber);
    doc.image(img, 0, 0, {
      fit: [pageWidth, pageHeight],
      align: "center",
      valign: "center",
    });
  });
};

const createDoc = () => {
  return new window.PDFDocument({
    layout: "landscape",
    size: [pageHeight, pageWidth],
    bufferPages: true,
    margin: 0,
  });
};

const loadFonts = async (doc: any) => {
  const fonts = ["Roboto-Medium", "Roboto-Bold"];
  for (const font of fonts) {
    const resp = await fetch(`${font}.ttf`);
    const buffer = await resp.arrayBuffer();
    doc.registerFont(font, buffer);
  }
};

const addSongPage = async (
  doc: any,
  score: ScoreViewModel,
  part: Part,
  currentPage: number,
  songPageIndex: number,
  displayNumber: string,
  partLabel: string | undefined,
  destId: string,
  sectionTitle: string,
  {
    instrument,
    backSheetPageNumber,
    debugBoundingBoxes,
  }: CreateSongBookOptions,
): Promise<[number, Promise<void>[]]> => {
  const initialPage = currentPage;
  const promises: Promise<void>[] = [];

  // Title with optional part label
  const displayTitle = partLabel
    ? `${score.title}: ${partLabel}`.toUpperCase()
    : score.title.toUpperCase();

  const hasSponsor = true;

  if (backSheetPageNumber) {
    const fontSize = hasSponsor ? 7 * cm2pt : 9 * cm2pt;
    const titleSpacing = 6 * cm2pt;
    const numberSpacing = 0;

    doc.addPage();
    currentPage++;

    if (hasSponsor) {
      await drawImage(doc, `assets/patrocinio-2026.png`, currentPage);

      doc
        .font("Roboto-Bold")
        .fontSize(fontSize)
        .text(songPageIndex, 4 * cm2pt, 1.5 * cm2pt + numberSpacing, {
          align: "center",
          width: 15 * cm2pt,
          height: fontSize,
        }); // Número do verso (somente número da música, sem número da parte)
      doc
        .font("Roboto-Medium")
        .fontSize(1 * cm2pt)
        .text(score.title.toUpperCase(), 8 * cm2pt, 3 * cm2pt + titleSpacing, {
          align: "center",
          width: 8 * cm2pt,
          height: 5 * cm2pt,
        }); // Título do verso
    } else {
      doc
        .font("Roboto-Bold")
        .fontSize(fontSize)
        .text(songPageIndex, 1 * cm2pt, 0.5 * cm2pt + numberSpacing, {
          align: "center",
          width: 16 * cm2pt,
          height: fontSize,
        }); // Número do verso (somente número da música, sem número da parte)
      doc
        .font("Roboto-Medium")
        .fontSize(1 * cm2pt)
        .text(score.title.toUpperCase(), 1 * cm2pt, 4 * cm2pt + titleSpacing, {
          align: "center",
          width: 16 * cm2pt,
          height: 9 * cm2pt,
        }); // Título do verso
    }
  }

  const totalSvgPages = part.svg.length;
  const isMultiPage = totalSvgPages > 1;

  for (let svgPageIdx = 0; svgPageIdx < totalSvgPages; svgPageIdx++) {
    doc.addPage();
    currentPage++;

    // Only add outline and destination on first page
    if (svgPageIdx === 0) {
      sectionTitleOutlines.get(sectionTitle).addItem(displayTitle);
      doc.addNamedDestination(destId);
    }

    // Measure displayNumber width to calculate available title space
    const numberFontSize = 1.2 * cm2pt;
    doc.font("Roboto-Bold").fontSize(numberFontSize);
    const numberWidth = doc.widthOfString(displayNumber);
    const padding = 0.3 * cm2pt;
    const totalWidth = 17.1 * cm2pt;
    const titleX = 0.39 * cm2pt;
    const titleY = 1.2 * cm2pt;
    const availableTitleWidth = totalWidth - numberWidth - padding;

    // Fit title to available space
    const titleFontSize = fitText(
      doc,
      displayTitle,
      "Roboto-Bold",
      22,
      12,
      availableTitleWidth,
    );
    doc.font("Roboto-Bold").fontSize(titleFontSize);
    const titleWidth = doc.widthOfString(displayTitle);
    const titleHeight = doc.currentLineHeight();
    debugRect(
      doc,
      titleX,
      titleY,
      titleWidth,
      titleHeight,
      "red",
      !!debugBoundingBoxes,
    );

    doc.text(displayTitle, titleX, titleY, {}); // Título

    // Debug rect for number
    const numberX = 0.44 * cm2pt + totalWidth - numberWidth;
    const numberY = 0.93 * cm2pt;
    doc.font("Roboto-Bold").fontSize(numberFontSize);
    const numberHeight = doc.currentLineHeight();
    debugRect(
      doc,
      numberX,
      numberY,
      numberWidth,
      numberHeight,
      "blue",
      !!debugBoundingBoxes,
    );

    doc.fontSize(numberFontSize).text(displayNumber, 0.44 * cm2pt, numberY, {
      align: "right",
      width: totalWidth,
    }); // Número topo página

    doc
      .rect(0.44 * cm2pt, 2.14 * cm2pt, 17.17 * cm2pt, 0.41 * cm2pt)
      .fillAndStroke(); // Retângulo do trecho da letra

    // Composer takes max 30% of line, sub takes remaining 70%
    const subComposerY = 2.21 * cm2pt;
    const subX = 0.5 * cm2pt;
    const subPadding = 0.3 * cm2pt;
    const maxComposerWidth = totalWidth * 0.3;
    const availableSubWidth =
      totalWidth * 0.7 - subPadding - (subX - 0.44 * cm2pt);

    // Fit composer to max 30%
    const composerText = score.composer.toUpperCase();
    const composerFontSize = fitText(
      doc,
      composerText,
      "Roboto-Bold",
      9,
      6,
      maxComposerWidth,
    );
    doc.font("Roboto-Bold").fontSize(composerFontSize);
    const composerWidth = doc.widthOfString(composerText);
    const composerHeight = doc.currentLineHeight();

    // Fit sub to available space
    const subText = score.sub.toUpperCase();
    const subFontSize = fitText(
      doc,
      subText,
      "Roboto-Bold",
      9,
      6,
      availableSubWidth,
    );
    doc.font("Roboto-Bold").fontSize(subFontSize);
    const subWidth = doc.widthOfString(subText);
    const subHeight = doc.currentLineHeight();
    debugRect(
      doc,
      subX,
      subComposerY,
      subWidth,
      subHeight,
      "green",
      !!debugBoundingBoxes,
    );

    doc.fillColor("white").text(subText, subX, subComposerY); // Trecho da letra

    // Debug rect for composer
    doc.font("Roboto-Bold").fontSize(composerFontSize);
    const composerX = 0.44 * cm2pt + totalWidth - composerWidth;
    debugRect(
      doc,
      composerX,
      subComposerY,
      composerWidth,
      composerHeight,
      "purple",
      !!debugBoundingBoxes,
    );

    doc.text(composerText, 0.44 * cm2pt, subComposerY, {
      align: "right",
      width: totalWidth,
    }); // Compositor

    doc.rect(0.44 * cm2pt, 2.55 * cm2pt, 17.17 * cm2pt, 9.82 * cm2pt).stroke(); // Retângulo da partitura
    doc
      .fontSize(9)
      .fillColor("black")
      .text(instrument.toUpperCase(), 0.44 * cm2pt, 12.5 * cm2pt); // Nome do instrumento

    // Centro do rodapé: "$título: $parte · página ($páginaAtual/$totalPáginas)"
    const bottomCenterLabel = isMultiPage
      ? `${displayTitle} · página (${svgPageIdx + 1}/${totalSvgPages})`
      : displayTitle;
    doc
      .font("Roboto-Medium")
      .fontSize(9)
      .text(bottomCenterLabel, 0, 12.5 * cm2pt, {
        align: "center",
      });

    // Direita do rodapé: "$estilo  $índiceMúsica.$índiceParte"
    doc
      .fontSize(9)
      .text(
        `${sectionTitle.toUpperCase()}   ${displayNumber}`,
        0.44 * cm2pt,
        12.5 * cm2pt,
        {
          align: "right",
          width: 17.1 * cm2pt,
        },
      );

    promises.push(
      drawSvg(doc, part.svg[svgPageIdx], currentPage),
    );
  }

  return [currentPage - initialPage, promises];
};

const createFileName = ({ title, instrument }: CreateSongBookOptions) => {
  return `${title.replace(/[ -]/g, "_")}_${instrument}.pdf`;
};

const addIndexPage = (
  doc: any,
  {
    sections,
    carnivalMode,
    instrument,
    fallbackInstrument,
  }: CreateSongBookOptions,
): number => {
  let pageCount = 0;

  // Count total lines (one per song, same layout for all instruments)
  const totalSongCount = sections.reduce(
    (acc, { scores }) => acc + scores.length,
    0,
  );
  const sectionCount = sections.length;
  let totalLineCount = totalSongCount + sectionCount * 2;

  const containerWidth = 17.17 * cm2pt;
  const containerHeight = 13 * cm2pt;

  let columnCount = 1;
  if (totalLineCount > 80) {
    columnCount = 4;
  } else if (totalLineCount > 50) {
    columnCount = 3;
  } else if (totalLineCount > 20) {
    columnCount = 2;
  }

  let maxLinesPerColumn = Math.floor(totalLineCount / columnCount) + 2;
  let fontSize = Math.min(
    Math.floor(containerHeight / maxLinesPerColumn) - 3,
    15,
  );
  let columnWidth = Math.ceil(containerWidth / columnCount);

  console.log(
    `containerWidth: ${containerWidth}\n containerHeight: ${containerHeight}\n totalLineCount: ${totalLineCount}\n columnCount: ${columnCount}\n maxLinexPerColumn: ${maxLinesPerColumn}\n fontSize: ${fontSize}\n columnWidth: ${columnWidth}\n`,
  );

  if (carnivalMode) {
    totalLineCount = 90;
    columnCount = 3;
    maxLinesPerColumn = 31;
    fontSize = 9;
    columnWidth = 163;
  }

  let cursorStartPosition = [1.44 * cm2pt, 1.55 * cm2pt];
  let currentColumn = 0;
  let currentLine = 0;
  let itemCount = 0;
  let songCount = 0;
  let firstPage = true;
  const resetCursorPosition = () => {
    cursorStartPosition = [1.44 * cm2pt, 1.55 * cm2pt];
    currentColumn = 0;
    currentLine = 0;
    itemCount = 0;
  };
  const nextCursorPosition = () => {
    if (itemCount == 0) {
      itemCount++;
      return cursorStartPosition;
    }
    currentColumn = Math.ceil((itemCount + 1) / (maxLinesPerColumn + 1)) - 1;
    currentLine = itemCount % (maxLinesPerColumn + 1);
    itemCount++;
    return [
      cursorStartPosition[0] + currentColumn * columnWidth + 1,
      cursorStartPosition[1] + currentLine * fontSize,
    ];
  };
  let [currentX, currentY] = nextCursorPosition();
  const reorderedScores: ScoreViewModel[] = [];

  doc.addPage();
  pageCount++;

  // .fontSize(25)
  // .font("Roboto-Bold")
  // .text("ÍNDICE", currentX + 0.3 * cm2pt, 1.2 * cm2pt);

  sections.forEach(({ title, scores }, styleIdx) => {
    if (carnivalMode) {
      if (
        firstPage &&
        songCount + (styleIdx + 1) * 2 + scores.length + 2 > totalLineCount
      ) {
        firstPage = false;
        resetCursorPosition();
        [currentX, currentY] = nextCursorPosition();
        doc.addPage().addPage();
        pageCount += 2;
      }

      // gambiarra do carnaval 2026, força a quebra de coluna no índice
      if (
        title.toLocaleLowerCase() == "pagode" ||
        title.toLocaleLowerCase() == "moments"
      ) {
        itemCount = 2 * (maxLinesPerColumn + 1);
        [currentX, currentY] = nextCursorPosition();
      } else if (title.toLocaleLowerCase() == "ebb") {
        itemCount = maxLinesPerColumn + 1;
        [currentX, currentY] = nextCursorPosition();
      }
    }

    scores.forEach((score, scoreIdx) => {
      reorderedScores.push(score);
      if (scoreIdx == 0) {
        if (currentLine == maxLinesPerColumn) {
          [currentX, currentY] = nextCursorPosition();
        }
        // título da seção
        if (title.length > 0) {
          doc
            .font("Roboto-Bold")
            .fontSize(fontSize - 2)
            .text(`${title.toUpperCase()}`, currentX + 0.3 * cm2pt, currentY);
          [currentX, currentY] = nextCursorPosition();
        }
      }

      let partsForInstrument =
        score.parts?.filter((p) => p.instrument === instrument) ?? [];
      if (partsForInstrument.length === 0 && fallbackInstrument) {
        partsForInstrument =
          score.parts?.filter((p) => p.instrument === fallbackInstrument) ?? [];
      }
      const hasInstrument = partsForInstrument.length > 0;
      const isMultiPart = partsForInstrument.length > 1;
      const songNumber = 1 + songCount++;
      // Link to first part for multi-part, or score.id for single part
      const destId = isMultiPart ? `${score.id}_0` : score.id;

      doc
        .font("Roboto-Bold")
        .fontSize(fontSize - 2)
        .text(songNumber, currentX - 0.5 * cm2pt, currentY, {
          align: "right",
          width: 0.6 * cm2pt,
          goTo: hasInstrument ? destId : undefined,
        });

      if (hasInstrument) {
        doc
          .font("Roboto-Medium")
          .fillColor("black")
          .text(
            `${score.title.toUpperCase()}`,
            currentX + 0.3 * cm2pt,
            currentY,
            {
              goTo: destId,
              width: columnWidth - 0.3 * cm2pt,
              height: fontSize,
              lineBreak: false,
            },
          );
      } else {
        doc
          .font("Roboto-Medium")
          .fillColor("gray")
          .text(
            `${score.title.toUpperCase()}`,
            currentX + 0.3 * cm2pt,
            currentY,
            {
              width: columnWidth - 0.3 * cm2pt,
              height: fontSize,
              lineBreak: false,
              strike: true,
            },
          )
          .fillColor("black");
      }
      [currentX, currentY] = nextCursorPosition();
    });
    if (currentLine != 0) [currentX, currentY] = nextCursorPosition();
  });
  if (carnivalMode) {
    doc.addPage();
    pageCount++;
  }

  return pageCount;
};
