import type { ScoreData } from "../../types/docs";

type LineageScore = Pick<ScoreData, "firstPublished" | "forkedFrom">;

export async function loadScoreLineage(
  scoreId: string,
  getScore: (id: string) => Promise<LineageScore | null>,
  getSongbook: (id: string) => Promise<{ title: string } | null>,
): Promise<string[]> {
  const titles: string[] = [];
  const visited = new Set<string>();
  let id: string | undefined = scoreId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const score = await getScore(id);
    if (!score) { break; }
    const book = score.firstPublished
      ? await getSongbook(score.firstPublished.songbookId)
      : null;
    titles.push(book?.title ?? (score.firstPublished ? "Caderninho indisponível" : "Ainda não publicada"));
    id = score.forkedFrom?.scoreId;
  }
  return titles.reverse();
}

export function compactScoreLineage(titles: string[]): string[] {
  return titles.length > 3
    ? [titles[0], "(…)", ...titles.slice(-2)]
    : titles;
}
