import { useCallback, useEffect, useState, ReactNode } from "react";
import Fuse, { IFuseOptions } from "fuse.js";
import { storagePathToUrl } from "./storage";
import { getAllProjects, getAllScores, getLatestRevisions } from "./lib/db";
import type { ScoreViewModel, RevisionViewModel, PartViewModel } from "../types/viewModels";
import { FEATURE_FLAG_AUTH_ENABLED } from "./featureFlags";
import {
  CollectionContext,
  type CollectionStatus,
} from "./useCollectionContext";

const CADERN_IN_UID = import.meta.env.VITE_CADERN_IN_UID as string | undefined;

async function loadCollection(): Promise<ScoreViewModel[]> {
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

  const scores: ScoreViewModel[] = [];

  for (const song of songDocs) {
    if (song.deletedAt) continue;
    const revision = revisionsByScoreId.get(song.id);
    if (!revision) continue;

    const parts: PartViewModel[] = revision.parts.map((p) => ({
      ...p,
      svg: p.svg.map(storagePathToUrl),
      midi: storagePathToUrl(p.midi),
    }));

    const latestRevision: RevisionViewModel = {
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      uploadedBy: revision.uploadedBy,
      uploadedAt: revision.uploadedAt,
      mscz: storagePathToUrl(revision.mscz),
      metajson: storagePathToUrl(revision.metajson),
      midi: storagePathToUrl(revision.midi),
      parts,
      notes: revision.notes,
      isLatest: revision.isLatest,
    };

    scores.push({
      id: song.id,
      title: song.title,
      composer: song.composer,
      sub: song.sub,
      tags: song.tags,
      projectTitle: projectTitles.get(song.projectId) ?? song.projectId,
      latestRevision,
    });
  }

  return scores;
}

const fuseOptions: IFuseOptions<ScoreViewModel> = {
  keys: ["title", "composer", "tags", "projectTitle"],
  includeScore: true,
  shouldSort: true,
  threshold: 0.1,
  useExtendedSearch: true,
  ignoreDiacritics: true,
  ignoreLocation: true,
};

function buildFuse(scores: ScoreViewModel[]): Fuse<ScoreViewModel> {
  const index = Fuse.createIndex(fuseOptions.keys as string[], scores);
  return new Fuse(scores, fuseOptions, index);
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CollectionStatus>("loading");
  const [allScores, setAllScores] = useState<ScoreViewModel[]>([]);
  const [fuse, setFuse] = useState<Fuse<ScoreViewModel> | null>(null);

  useEffect(() => {
    loadCollection()
      .then((scores) => {
        setAllScores(scores);
        setFuse(buildFuse(scores));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const search = useCallback(
    (query: string): ScoreViewModel[] => {
      if (!fuse || query === "") return allScores;
      return fuse.search(query).map((r) => r.item);
    },
    [fuse, allScores],
  );

  return (
    <CollectionContext.Provider value={{ status, allScores, search }}>
      {children}
    </CollectionContext.Provider>
  );
}
