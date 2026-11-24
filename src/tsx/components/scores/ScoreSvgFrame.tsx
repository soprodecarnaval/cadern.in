import { useEffect, useMemo, useRef, type CSSProperties } from "react";

const emptyNotes: readonly string[] = [];

function highlightNotes(doc: Document, previous: readonly string[], active: readonly string[]) {
  for (const id of previous) {
    doc.getElementById(id)?.removeAttribute("data-playing");
  }
  for (const id of active) {
    const note = doc.getElementById(id);
    if (note?.classList.contains("note")) {note.setAttribute("data-playing", "");}
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
  .note[data-playing] { color: #1659c5; fill: #1659c5; }
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
