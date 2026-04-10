import { useCallback, useEffect, useState, ReactNode } from "react";
import Fuse, { IFuseOptions } from "fuse.js";
import { storagePathToUrl } from "./storage";
import { getAllProjects, getAllScores, getLatestRevisions } from "./lib/db";
import type { LegacyCollection, LegacyScore, Part } from "../types";
import { FEATURE_FLAG_AUTH_ENABLED } from "./featureFlags";
import {
  CollectionContext,
  type CollectionStatus,
} from "./useCollectionContext";

const CADERN_IN_UID = import.meta.env.VITE_CADERN_IN_UID as string | undefined;

async function loadCollection(): Promise<LegacyCollection> {
  const [projectDocs, songDocs, revisionDocs] = await Promise.all([
    getAllProjects(),
    getAllScores(),
    getLatestRevisions(),
  ]);

  const filteredProjectDocs = FEATURE_FLAG_AUTH_ENABLED
    ? projectDocs
    : projectDocs.filter((p) => p.ownerId === CADERN_IN_UID);

  const projectTitles = new Map(
    filteredProjectDocs.map((p) => [p.id, p.title]),
  );

  const revisionsByScoreId = new Map(revisionDocs.map((r) => [r.scoreId, r]));

  const scoresByProject = new Map<string, LegacyScore[]>();

  for (const song of songDocs) {
    if (song.deletedAt) continue;
    const revision = revisionsByScoreId.get(song.id);
    if (!revision) continue;

    const parts: Part[] = revision.parts.map((p) => ({
      ...p,
      svg: p.svg.map(storagePathToUrl),
      midi: storagePathToUrl(p.midi),
    }));

    const score: LegacyScore = {
      id: song.id,
      title: song.title,
      composer: song.composer,
      sub: song.sub,
      tags: song.tags,
      projectTitle: projectTitles.get(song.projectId) ?? song.projectId,
      mscz: storagePathToUrl(revision.mscz),
      metajson: storagePathToUrl(revision.metajson),
      midi: storagePathToUrl(revision.midi),
      parts,
    };

    const existing = scoresByProject.get(song.projectId) ?? [];
    existing.push(score);
    scoresByProject.set(song.projectId, existing);
  }

  const projects = Array.from(scoresByProject.entries()).map(
    ([projectId, scores]) => ({
      title: projectTitles.get(projectId) ?? projectId,
      scores,
    }),
  );

  return { projects, version: 3 };
}

const fuseOptions: IFuseOptions<LegacyScore> = {
  keys: ["title", "composer", "tags", "projectTitle"],
  includeScore: true,
  shouldSort: true,
  threshold: 0.1,
  useExtendedSearch: true,
  ignoreDiacritics: true,
  ignoreLocation: true,
};

function buildFuse(scores: LegacyScore[]): Fuse<LegacyScore> {
  const index = Fuse.createIndex(fuseOptions.keys as string[], scores);
  return new Fuse(scores, fuseOptions, index);
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CollectionStatus>("loading");
  const [allLegacyScores, setAllLegacyScores] = useState<LegacyScore[]>([]);
  const [fuse, setFuse] = useState<Fuse<LegacyScore> | null>(null);

  useEffect(() => {
    loadCollection()
      .then((col) => {
        const scores = col.projects.flatMap((p) => p.scores);
        setAllLegacyScores(scores);
        setFuse(buildFuse(scores));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const search = useCallback(
    (query: string): LegacyScore[] => {
      if (!fuse || query === "") return allLegacyScores;
      return fuse.search(query).map((r) => r.item);
    },
    [fuse, allLegacyScores],
  );

  return (
    <CollectionContext.Provider value={{ status, allLegacyScores, search }}>
      {children}
    </CollectionContext.Provider>
  );
}
