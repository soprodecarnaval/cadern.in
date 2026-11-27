import { useEffect, useMemo, useRef, type CSSProperties } from "react";

const emptyNotes: readonly string[] = [];

// Verovio classes: notes, rests, whole-measure and multi-measure rests.
const PLAYABLE = ["note", "rest", "mRest", "multiRest"];

function highlightNotes(doc: Document, previous: readonly string[], active: readonly string[]) {
  for (const id of previous) {
    doc.getElementById(id)?.removeAttribute("data-playing");
  }
  for (const id of active) {
    const element = doc.getElementById(id);
    if (element && PLAYABLE.some((name) => element.classList.contains(name))) {element.setAttribute("data-playing", "");}
  }
}

/** Keep score markup, IDs and fonts isolated from the app document. */
export function ScoreSvgFrame({ svg, label, activeNotes = emptyNotes, css = "", className, style, tabIndex, onReady }: {
  svg: string;
  label: string;
  activeNotes?: readonly string[];
  css?: string;
  className?: string;
  style?: CSSProperties;
  tabIndex?: number;
  onReady?: (doc: Document) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const highlighted = useRef(emptyNotes);
  const active = useRef(activeNotes);
  active.current = activeNotes;
  const markup = useMemo(() => `<!doctype html><html lang="pt-BR"><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'">
<style>
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
  body > svg { display: block; width: 100%; height: 100%; }
  /* The note playing stays black, with the site's yellow glowing around it
     like a highlighter: a yellow note would vanish on the white page. The
     sizes are in the score's own units (Verovio draws at about 1/20 of a
     screen pixel on a score page), so this is a 1–2px glow on screen. */
  [data-playing] {
    filter: drop-shadow(0 0 30px #fcee21) drop-shadow(0 0 30px #fcee21) drop-shadow(0 0 30px #fcee21);
  }
  ${css}
</style></head><body>${svg}</body></html>`, [css, svg]);

  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc || doc.URL !== "about:srcdoc") {return;}
    highlightNotes(doc, highlighted.current, activeNotes);
    highlighted.current = activeNotes;
  }, [activeNotes]);

  return <iframe ref={frame} title={label} sandbox="allow-same-origin" srcDoc={markup} className={className} style={style} tabIndex={tabIndex}
    onLoad={(event) => {
      const doc = event.currentTarget.contentDocument;
      if (!doc || doc.URL !== "about:srcdoc") {return;}
      highlightNotes(doc, emptyNotes, active.current);
      highlighted.current = active.current;
      onReady?.(doc);
    }} />;
}
