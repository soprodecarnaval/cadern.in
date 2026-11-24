import { useEffect, useState } from "react";
import { fontFaceCss, loadTextFonts, needsTextFonts, withTextFonts } from "./sharedFonts";

/**
 * A URL to show a stored part SVG as an image. Library-rendered pages name
 * shared text fonts without embedding them (014), and an <img> SVG can't load
 * outside fonts, so they are embedded again here and shown from a blob URL.
 * Other SVGs (MuseScore exports) are shown as they are. Falls back to the
 * original URL if anything fails.
 */
export function useSvgUrl(url: string): string {
  return useScoreSvg(url).url;
}

const allowedSvgElements = new Set([
  "svg", "g", "path", "polyline", "polygon", "line", "rect", "circle", "ellipse",
  "defs", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "use",
  "image", "title", "desc", "text", "tspan", "style",
]);

function interactiveSvg(svg: string): string | undefined {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (doc.doctype || root.localName !== "svg" ||
      Array.from(doc.querySelectorAll("*")).some((element) =>
        element.namespaceURI !== "http://www.w3.org/2000/svg" || !allowedSvgElements.has(element.localName))) {return;}
  // Normalize CDATA before serializing XML for the sandboxed HTML frame.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION);
  const special: Node[] = [];
  while (walker.nextNode()) {special.push(walker.currentNode);}
  for (const node of special) {
    if (node.nodeType === Node.CDATA_SECTION_NODE) {
      node.parentNode?.replaceChild(doc.createTextNode(node.textContent ?? ""), node);
    } else {
      node.parentNode?.removeChild(node);
    }
  }
  return new XMLSerializer().serializeToString(root);
}

export function useScoreSvg(url: string, withMarkup = false): { url: string; markup?: string } {
  const [shown, setShown] = useState<{ source: string; url: string; markup?: string }>({ source: url, url });
  useEffect(() => {
    let current = true;
    let blobUrl: string | null = null;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {return;}
        let svg = await response.text();
        if (!current) {return;}
        const fonts = await loadTextFonts().catch(() => []);
        if (!current) {return;}
        if (needsTextFonts(svg, fonts.map(({ font }) => font.family))) {
          svg = withTextFonts(svg, fontFaceCss(fonts));
          blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        }
        setShown({ source: url, url: blobUrl ?? url, markup: withMarkup ? interactiveSvg(svg) : undefined });
      } catch {
        // Keep the original URL.
      }
    })();
    return () => {
      current = false;
      controller.abort();
      if (blobUrl) {URL.revokeObjectURL(blobUrl);}
    };
  }, [url, withMarkup]);
  return shown.source === url ? shown : { url };
}
