import { readFileSync } from "node:fs";
import { z } from "zod";
import { carnivalSectionOrder } from "../../src/utils/sort";

export const DEFERRED_STYLE_SCORES = z.array(z.object({ scoreId: z.string(), title: z.string() })).parse(
  JSON.parse(readFileSync(new URL("../data/collabDeferredStyles.json", import.meta.url), "utf8")),
);
export const DEFERRED_STYLE_IDS = new Set(DEFERRED_STYLE_SCORES.map((score) => score.scoreId));

interface StyleScore { id: string; title: string; tags: string[] }

const titleKey = (title: string) => title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const styleKey = (style: string) => style.trim().toLowerCase().replace(/s$/, "");
const canonicalStyles = new Map(carnivalSectionOrder.map((style) => [styleKey(style), style]));

export function inferCarnivalStyle(score: StyleScore, candidates: StyleScore[]) {
  const ownStyle = canonicalStyles.get(styleKey(score.tags[0] ?? ""));
  if (ownStyle) return { status: "known" as const, style: ownStyle, sourceScoreIds: [] as string[] };
  const key = titleKey(score.title);
  const matches = key ? candidates.filter((candidate) =>
    candidate.id !== score.id && titleKey(candidate.title) === key && canonicalStyles.has(styleKey(candidate.tags[0] ?? "")),
  ) : [];
  const styles = [...new Set(matches.map((candidate) => canonicalStyles.get(styleKey(candidate.tags[0]))!))].sort();
  const sourceScoreIds = matches.map((candidate) => candidate.id).sort();
  if (styles.length === 1) return { status: "inferred" as const, style: styles[0], sourceScoreIds };
  return { status: styles.length ? "conflict" as const : "missing" as const, style: null, sourceScoreIds };
}
