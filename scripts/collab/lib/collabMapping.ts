export interface CatalogMapping {
  source: string;
  project: string;
  title: string;
  songbook: string | null;
  grouping?: "carnival" | "style";
}

export const COLLAB_MAPPING: CatalogMapping[] = [
  { source: "besourinhos-2024", project: "besourinhos", title: "Besourinhos", songbook: "2024" },
  { source: "blocae", project: "blocae", title: "blocae", songbook: "acervo" },
  { source: "carnaval-bh-2020", project: "carnaval-bh", title: "Carnaval BH", songbook: "2020" },
  { source: "carnaval-bh-2023", project: "carnaval-bh", title: "Carnaval BH", songbook: "2023" },
  { source: "carnaval-bh-2024", project: "carnaval-bh", title: "Carnaval BH", songbook: "2024" },
  { source: "carnaval-bh-2025", project: "carnaval-bh", title: "Carnaval BH", songbook: "2025" },
  { source: "carnaval-bh-2026", project: "carnaval-bh", title: "Carnaval BH", songbook: "2026" },
  { source: "crack-carnaval-bh-2026", project: "carnaval-bh", title: "Carnaval BH", songbook: "crack-2026" },
  { source: "festa-junina-2024", project: "carnaval-bh", title: "Carnaval BH", songbook: "festa-junina-2024", grouping: "style" },
  { source: "garota-2024", project: "garota", title: "Garota", songbook: "2024" },
  { source: "garota-2025", project: "garota", title: "Garota", songbook: "2025" },
  { source: "garota-2026", project: "garota", title: "Garota", songbook: "2026" },
  { source: "madeira-pirata", project: "madeira-pirata", title: "madeira pirata", songbook: null },
  { source: "mama-vaquinha-2024", project: "mama-vaquinha", title: "Mamá Vaquinha", songbook: "2024" },
  { source: "miscellaneous", project: "miscellaneous", title: "miscellaneous", songbook: "acervo" },
  { source: "na-tora-2025", project: "na-tora", title: "Na Tora", songbook: "2025" },
  { source: "na-tora-2026", project: "na-tora", title: "Na Tora", songbook: "2026" },
  { source: "queimando-2024", project: "queimando", title: "Queimando", songbook: "2024" },
  { source: "sopra-que-sara", project: "sopra-que-sara", title: "sopra que sara", songbook: "acervo" },
  { source: "zagateile", project: "zagateile", title: "zagateile", songbook: "acervo" },
];

export interface SourceAssignment extends CatalogMapping {
  scoreIds: string[];
}

interface Project { id: string; deletedAt?: unknown }
interface Score { id: string; projectId: string; deletedAt?: unknown }

export function planAssignments(
  projects: Project[], scores: Score[], saved: SourceAssignment[],
  mapping: CatalogMapping[] = COLLAB_MAPPING,
): { assignments: SourceAssignment[]; errors: string[] } {
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  const songbooks = new Set<string>();
  for (const row of mapping) {
    if (row.songbook === null && row.source !== row.project) throw new Error("Retired projects must keep their scores at the original project");
    if (sourceIds.has(row.source) || (row.songbook !== null && songbooks.has(`${row.project}/${row.songbook}`))) {
      throw new Error("Duplicate source project or destination songbook in collab mapping");
    }
    sourceIds.add(row.source);
    if (row.songbook !== null) songbooks.add(`${row.project}/${row.songbook}`);
  }
  const byProject = new Map(projects.map((project) => [project.id, project]));
  const byScore = new Map(scores.map((score) => [score.id, score]));
  const journals = new Map(saved.map((assignment) => [assignment.source, assignment]));
  for (const journal of saved) {
    const row = mapping.find((row) => row.source === journal.source);
    if (!row || row.project !== journal.project || row.songbook !== journal.songbook || row.grouping !== journal.grouping) {
      errors.push(`Journal mapping changed: ${journal.source}`);
    }
  }
  const assignments: SourceAssignment[] = [];
  for (const row of mapping) {
    const original = byProject.get(row.source);
    const journal = journals.get(row.source);
    if (!journal && (!original || original.deletedAt)) continue;
    assignments.push(journal ?? {
      ...row,
      scoreIds: scores.filter((score) => score.projectId === row.source).map((score) => score.id).sort(),
    });
  }
  const assigned = new Set<string>();
  for (const assignment of assignments) {
    for (const id of assignment.scoreIds) {
      if (assigned.has(id)) errors.push(`Score assigned twice: ${id}`);
      assigned.add(id);
      const score = byScore.get(id);
      if (!score) errors.push(`Journal score missing: ${id}`);
      else if (score.projectId !== assignment.source && score.projectId !== assignment.project) {
        errors.push(`Score moved outside its mapping: ${id}`);
      }
    }
  }
  const destinations = new Set(mapping.map((row) => row.project));
  for (const project of projects) {
    if (!project.deletedAt && !sourceIds.has(project.id) && !destinations.has(project.id)) {
      errors.push(`Unmapped project: ${project.id}`);
    }
  }
  for (const score of scores) {
    const project = byProject.get(score.projectId);
    if (!assigned.has(score.id) && (!project || !project.deletedAt)) {
      errors.push(`Unmapped score: ${score.id} (${score.projectId})`);
    }
  }
  return { assignments, errors };
}
