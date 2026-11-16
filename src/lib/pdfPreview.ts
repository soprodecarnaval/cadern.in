import type { Instrument } from "../../types/instrument";

export const POINTS_PER_CM = 28.3465;
export const COVER_LAYOUT = {
  pageWidth: 18 * POINTS_PER_CM,
  pageHeight: 13 * POINTS_PER_CM,
  textX: 120,
  titleY: 100,
  instrumentY: 125,
  titleFontSize: 25,
  instrumentFontSize: 22,
} as const;

export interface CoverPreviewOptions {
  title: string;
  instrument: Instrument;
  coverImageUrl: string;
  carnivalMode: boolean;
}

export const carnivalCoverUrl = (instrument: Instrument): string =>
  `/assets/capa_carnaval_2026_${instrument.replace(/[ ]/g, "_")}.png`;

function loadCover(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem da capa."));
    image.src = url;
  });
}

function drawCoverText(context: CanvasRenderingContext2D, text: string, size: number, y: number) {
  context.font = `${size}px Helvetica, Arial, sans-serif`;
  context.textBaseline = "top";
  const maxWidth = COVER_LAYOUT.pageWidth - COVER_LAYOUT.textX;
  let line = "";
  for (const paragraph of text.toUpperCase().split("\n")) {
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        context.fillText(line, COVER_LAYOUT.textX, y);
        y += size * 1.15;
        line = word;
      } else {
        line = candidate;
      }
      while (context.measureText(line).width > maxWidth) {
        let end = line.length;
        while (end > 1 && context.measureText(line.slice(0, end)).width > maxWidth) { end--; }
        context.fillText(line.slice(0, end), COVER_LAYOUT.textX, y);
        y += size * 1.15;
        line = line.slice(end);
      }
    }
    context.fillText(line, COVER_LAYOUT.textX, y);
    y += size * 1.15;
    line = "";
  }
}

export async function createSongbookCoverPreview(options: CoverPreviewOptions): Promise<string> {
  const { pageWidth, pageHeight } = COVER_LAYOUT;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(pageWidth * 2);
  canvas.height = Math.ceil(pageHeight * 2);
  const context = canvas.getContext("2d");
  if (!context) { throw new Error("Não foi possível criar a prévia da capa."); }
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(2, 2);
  context.fillStyle = "black";
  if (options.coverImageUrl || !options.carnivalMode) {
    drawCoverText(context, options.title, COVER_LAYOUT.titleFontSize, COVER_LAYOUT.titleY);
    drawCoverText(context, options.instrument, COVER_LAYOUT.instrumentFontSize, COVER_LAYOUT.instrumentY);
  }
  const imageUrl = options.coverImageUrl || (options.carnivalMode ? carnivalCoverUrl(options.instrument) : "");
  if (imageUrl) {
    const image = await loadCover(imageUrl);
    const scale = Math.min(pageWidth / image.naturalWidth, pageHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    // PDF generation paints the fitted image after the title and instrument.
    context.drawImage(image, (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) { resolve(result); } else { reject(new Error("Não foi possível renderizar a prévia.")); }
    }, "image/png");
  });
  return URL.createObjectURL(blob);
}
