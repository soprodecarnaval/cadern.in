const SVG_NS = "http://www.w3.org/2000/svg";

const markingClasses = new Set(["fing", "reh", "tempo", "dir", "repeatMark"]);
export const VOLTA_BRACKET = "g.ending.spanning > g.voltaBracket";
export const MOVABLE_MARKING = [...Array.from(markingClasses, (name) => `g.${name}[id]`), VOLTA_BRACKET].join(", ");

export type MarkingTarget = { id: string } | { voltaIndex: number };
export type MarkingMove = MarkingTarget & { x: number; y: number };

const hasClass = (element: Element | null, name: string) =>
  element?.getAttribute("class")?.split(/\s+/).includes(name);

function voltaBracket(element: Element): boolean {
  const parent = element.parentElement;
  return element.namespaceURI === SVG_NS && parent?.localName === "g" &&
    !!hasClass(parent, "ending") && !!hasClass(parent, "spanning") && !!hasClass(element, "voltaBracket");
}

export function translatedTransform(original: string | null, x: number, y: number): string {
  const translate = `translate(${x} ${y})`;
  return original ? `${translate} ${original}` : translate;
}

export function moveMarking(svg: string, move: MarkingMove): string | null {
  const { x, y } = move;
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {return null;}
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.documentElement.namespaceURI !== SVG_NS || doc.documentElement.localName !== "svg") {return null;}
  // Verovio's volta brackets have no IDs. Their order is the same in the raw and preview SVGs.
  const marking = "id" in move
    ? doc.getElementById(move.id)
    : Array.from(doc.getElementsByTagNameNS(SVG_NS, "g")).filter(voltaBracket)[move.voltaIndex];
  if (!marking || marking.namespaceURI !== SVG_NS || marking.localName !== "g") {return null;}
  if ("id" in move && !marking.getAttribute("class")?.split(/\s+/).some((name) => markingClasses.has(name))) {return null;}
  marking.setAttribute("transform", translatedTransform(marking.getAttribute("transform"), x, y));
  return new XMLSerializer().serializeToString(doc.documentElement);
}
