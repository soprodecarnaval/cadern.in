import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function pdfFirstPageImage(url: string): Promise<string> {
  const loading = getDocument({ url, disableWorkerRendering: true, useSystemFonts: true });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) { resolve(result); } else { reject(new Error("Não foi possível renderizar a prévia.")); }
      }, "image/png");
    });
    return URL.createObjectURL(blob);
  } finally {
    await loading.destroy();
  }
}
