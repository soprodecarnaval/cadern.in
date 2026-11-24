import { useRef } from "react";
import { ScoreSvgFrame } from "../../components/scores/ScoreSvgFrame";
import { MOVABLE_MARKING, VOLTA_BRACKET, translatedTransform, type MarkingMove, type MarkingTarget } from "../../../lib/scoreRender/collisionSvg";

type Drag = {
  pointer: number;
  marking: SVGGElement;
  target: MarkingTarget;
  parent: SVGGraphicsElement;
  original: string | null;
  start: DOMPoint;
  x: number;
  y: number;
};

function point(parent: SVGGraphicsElement, event: PointerEvent): DOMPoint | undefined {
  const matrix = parent.getScreenCTM();
  if (!matrix) {return;}
  const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  if (Number.isFinite(local.x) && Number.isFinite(local.y)) {return local;}
}

const editorCss = `
  body { touch-action: none; user-select: none; }
  :is(${MOVABLE_MARKING}) { cursor: grab; }
  [data-dragging] { cursor: grabbing; }
  [data-volta-hit-target] {
    fill: none;
    stroke: transparent;
    stroke-width: 12px;
    vector-effect: non-scaling-stroke;
    pointer-events: stroke;
  }
  :is(${MOVABLE_MARKING}):hover, [data-dragging] { filter: drop-shadow(0 0 1px #2868d9); }`;

export function CollisionPage({ svg, label, onMove, activeNotes }: {
  svg: string;
  label: string;
  activeNotes?: readonly string[];
  onMove: (move: MarkingMove) => void;
}) {
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  return <ScoreSvgFrame svg={svg} label={label} activeNotes={activeNotes} className="enviar-collision-page" css={editorCss}
    onReady={(doc) => {
      const brackets = Array.from(doc.querySelectorAll<SVGGElement>(VOLTA_BRACKET));
      // Give the thin printed lines a wider target in the editor only.
      for (const bracket of brackets) {
        for (const path of bracket.querySelectorAll("path")) {
          const hit = path.cloneNode(false) as SVGPathElement;
          hit.removeAttribute("id");
          hit.setAttribute("data-volta-hit-target", "");
          path.before(hit);
        }
      }
      let drag: Drag | undefined;
      doc.onpointerdown = (pointer) => {
        if (drag || pointer.button !== 0 || !pointer.isPrimary) {return;}
        const marking = (pointer.target as Element | null)?.closest?.<SVGGElement>(MOVABLE_MARKING);
        const parent = marking?.parentElement as SVGGraphicsElement | null | undefined;
        if (!marking || !parent?.getScreenCTM) {return;}
        const start = point(parent, pointer);
        if (!start) {return;}
        const target = marking.matches(VOLTA_BRACKET)
          ? { voltaIndex: brackets.indexOf(marking) }
          : { id: marking.id };
        pointer.preventDefault();
        marking.setPointerCapture(pointer.pointerId);
        marking.setAttribute("data-dragging", "");
        drag = { pointer: pointer.pointerId, marking, target, parent, start, original: marking.getAttribute("transform"), x: 0, y: 0 };
      };
      doc.onpointermove = (pointer) => {
        if (!drag || drag.pointer !== pointer.pointerId) {return;}
        const current = point(drag.parent, pointer);
        if (!current) {return;}
        drag.x = Math.round((current.x - drag.start.x) * 100) / 100;
        drag.y = Math.round((current.y - drag.start.y) * 100) / 100;
        drag.marking.setAttribute("transform", translatedTransform(drag.original, drag.x, drag.y));
      };
      const finish = (pointer: PointerEvent, save: boolean) => {
        if (!drag || drag.pointer !== pointer.pointerId) {return;}
        const { marking, target, original, x, y } = drag;
        drag = undefined;
        marking.removeAttribute("data-dragging");
        if (save && (x || y)) {
          onMoveRef.current({ ...target, x, y });
        } else if (original === null) {
          marking.removeAttribute("transform");
        } else {
          marking.setAttribute("transform", original);
        }
      };
      doc.onpointerup = (pointer) => {
        doc.onpointermove?.(pointer);
        finish(pointer, true);
      };
      doc.onpointercancel = (pointer) => finish(pointer, false);
      doc.onlostpointercapture = (pointer) => finish(pointer, false);
    }} />;
}
