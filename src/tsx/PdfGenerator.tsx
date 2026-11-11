import { generateSongbookPdfs } from "../lib/generateSongbookPdfs";
import { PDFGeneratorView, type PdfGeneratorProps } from "./PdfGeneratorView";
export type { Section } from "./PdfGeneratorView";
export function PDFGenerator(props: PdfGeneratorProps) {
  return (
    <PDFGeneratorView {...props} generateSongbookPdfs={generateSongbookPdfs} />
  );
}
