import type { FormattingProfile, ManualOffset } from "../../../types/formattingProfile";

const SVG_NS = "http://www.w3.org/2000/svg";

const markingClasses = new Set(["fing", "reh", "tempo", "dir", "repeatMark"]);
export const VOLTA_BRACKET = "g.ending > g.voltaBracket";
export const MOVABLE_MARKING = [...Array.from(markingClasses, (name) => `g.${name}[id]`), VOLTA_BRACKET].join(", ");

export type MarkingTarget = { id: string } | { voltaIndex: number };
export type MarkingMove = MarkingTarget & { x: number; y: number };

const hasClass = (element: Element | null, name: string) =>
  element?.getAttribute("class")?.split(/\s+/).includes(name);

function voltaBracket(element: Element): boolean {
  const parent = element.parentElement;
  return element.namespaceURI === SVG_NS && parent?.localName === "g" &&
    !!hasClass(parent, "ending") && !!hasClass(element, "voltaBracket");
}

export function translatedTransform(original: string | null, x: number, y: number): string {
  const translate = `translate(${x} ${y})`;
  return original ? `${translate} ${original}` : translate;
}

function scoreRoot(svg: string): Element | null {
  const { documentElement } = new DOMParser().parseFromString(svg, "image/svg+xml");
  return documentElement.namespaceURI === SVG_NS && documentElement.localName === "svg" ? documentElement : null;
}

function markings(root: Element) {
  const result = new Map<string, { element: Element; target: MarkingTarget; identity: string }>();
  let voltaIndex = 0;
  for (const element of Array.from(root.getElementsByTagNameNS(SVG_NS, "g"))) {
    const id = element.getAttribute("id");
    const classes = element.getAttribute("class")?.split(/\s+/) ?? [];
    const kind = classes.find((name) => markingClasses.has(name));
    const volta = voltaBracket(element);
    if (!volta && (!kind || !id)) {continue;}
    const target = volta ? { voltaIndex: voltaIndex++ } : { id: id! };
    const parent = element.parentElement;
    const ending = volta ? parent?.getAttribute("id") ?? parent?.getAttribute("class")?.split(/\s+/).find((name) => name.startsWith("id-"))?.slice(3) : null;
    let measure = parent;
    while (measure && !hasClass(measure, "measure")) {measure = measure.parentElement;}
    const glyphs = Array.from(element.getElementsByTagNameNS(SVG_NS, "use")).map((use) =>
      (use.getAttribute("href") || use.getAttributeNS("http://www.w3.org/1999/xlink", "href"))?.split("-")[0]);
    const identity = JSON.stringify([
      volta ? "volta" : classes,
      element.getAttribute("data-startid"),
      ending,
      kind !== "fing" && !volta ? measure?.getAttribute("id") : null,
      element.textContent?.replace(/\s+/g, " ").trim(),
      glyphs,
    ]);
    result.set(targetKey(target), { element, target, identity });
  }
  return result;
}

const targetKey = (target: MarkingTarget): string =>
  "id" in target ? `id:${target.id}` : `volta:${target.voltaIndex}`;

export function moveMarking(svg: string, move: MarkingMove): string | null {
  const { x, y } = move;
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {return null;}
  const root = scoreRoot(svg);
  if (!root) {return null;}
  const marking = markings(root).get(targetKey(move))?.element;
  if (!marking) {return null;}
  marking.setAttribute("transform", translatedTransform(marking.getAttribute("transform"), x, y));
  return new XMLSerializer().serializeToString(root);
}

/** The editor prepends translations. Compare against the engraving so any native transform is preserved. */
export function readManualOffsets(original: string, edited: string): ManualOffset[] {
  if (original === edited) {return [];}
  const before = scoreRoot(original), after = scoreRoot(edited);
  if (!before || !after) {return [];}
  const moved = markings(after);
  const offsets: ManualOffset[] = [];
  for (const [key, { element, target, identity }] of markings(before)) {
    const candidate = moved.get(key);
    if (candidate?.identity !== identity) {continue;}
    const originalTransform = element.getAttribute("transform") ?? "";
    let remaining = candidate.element.getAttribute("transform") ?? "";
    let x = 0, y = 0;
    while (remaining !== originalTransform) {
      const translation = /^translate\((-?[\d.]+) (-?[\d.]+)\)(?: |$)/.exec(remaining);
      if (!translation) {break;}
      x += Number(translation[1]);
      y += Number(translation[2]);
      remaining = remaining.slice(translation[0].length);
    }
    if (remaining === originalTransform && Number.isFinite(x) && Number.isFinite(y) && (x || y)) {
      offsets.push({ target, identity, x, y });
    }
  }
  return offsets;
}

export function applyManualOffsets(svg: string, offsets: readonly ManualOffset[], allowFallback = true) {
  if (!offsets.length) {return { svg, unmatched: [] as ManualOffset[] };}
  const root = scoreRoot(svg);
  if (!root) {return { svg, unmatched: [...offsets] };}
  const available = markings(root);
  const unmatched: ManualOffset[] = [];
  for (const offset of offsets) {
    const key = targetKey(offset.target);
    const exact = available.get(key);
    // The saved ID/index can change when Verovio reflows the part. Fall back
    // only if a single marking still has the same musical identity.
    const candidates = exact?.identity === offset.identity ? [[key, exact] as const] :
      allowFallback ? [...available].filter(([, marking]) => marking.identity === offset.identity) : [];
    if (candidates.length !== 1) {unmatched.push(offset); continue;}
    const [matchedKey, { element }] = candidates[0];
    element.setAttribute("transform", translatedTransform(element.getAttribute("transform"), offset.x, offset.y));
    available.delete(matchedKey);
  }
  return { svg: unmatched.length === offsets.length ? svg : new XMLSerializer().serializeToString(root), unmatched };
}

export async function recoverManualOffsets(svg: string, url: string | undefined, signal?: AbortSignal): Promise<ManualOffset[]> {
  if (!url) {return [];}
  try {
    const response = await fetch(url, { signal });
    return response.ok ? readManualOffsets(svg, await response.text()) : [];
  } catch {
    signal?.throwIfAborted();
    return [];
  }
}


export function manualOffsetsFor(profile: FormattingProfile, ordinal: number): ManualOffset[] | undefined {
  const offsets = profile.manualOffsets?.[String(ordinal)];
  return Array.isArray(offsets) ? offsets : undefined;
}
