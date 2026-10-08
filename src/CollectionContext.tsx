import { useCallback, useEffect, useState, ReactNode } from "react";
import Fuse, { IFuseOptions } from "fuse.js";
import {
  getAllProjects,
  getAllScores,
  getLatestScoreRevisions,
} from "./lib/db";
import { legacyIsOwner } from "./lib/roles";
import { toScoreViewModel } from "./lib/viewModels";
import type { ScoreViewModel } from "../types/viewModels";
import { FEATURE_FLAG_COLLAB_FLOW } from "./featureFlags";
import {
  CollectionContext,
  type CollectionStatus,
} from "./useCollectionContext";

const CADERNIN_UID = import.meta.env.VITE_CADERNIN_UID;

async function loadCollection(): Promise<ScoreViewModel[]> {
  console.log(">>>> loadCollection");
  const [projectDocs, songDocs, revisionDocs] = await Promise.all([
    getAllProjects(),
    getAllScores(),
    getLatestScoreRevisions(),
  ]);

  console.log(songDocs.length);

  const filteredProjectDocs = FEATURE_FLAG_COLLAB_FLOW
    ? projectDocs
    : projectDocs.filter((p) => CADERNIN_UID && legacyIsOwner(p, CADERNIN_UID));

  const projectTitles = new Map(
    filteredProjectDocs.map((p) => [p.id, p.title]),
  );

  const revisionsByScoreId = new Map(revisionDocs.map((r) => [r.scoreId, r]));
  // getAllProjects returns live projects only; a deleted project hides its
  // scores (collab-flow §6).
  const liveProjectIds = new Set(projectDocs.map((p) => p.id));

  const scores: ScoreViewModel[] = [];

  for (const song of songDocs) {
    if (song.deletedAt || !liveProjectIds.has(song.projectId)) {
      continue;
    }
    const revision = revisionsByScoreId.get(song.id);
    if (!revision) {
      continue;
    }

    scores.push(
      toScoreViewModel(
        song,
        revision,
        projectTitles.get(song.projectId) ?? song.projectId,
      ),
    );
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
      .catch((err) => {
        console.error("loadCollection failed", err);
        setStatus("error");
      });
  }, []);

  const search = useCallback(
    (query: string): ScoreViewModel[] => {
      if (!fuse || query === "") {return allScores;}
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
