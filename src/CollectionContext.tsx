import { useEffect, useMemo, useState, ReactNode } from "react";
import {
  getAllProjects,
  getAllScores,
  getLatestScoreRevisions,
  getScoreRevision,
} from "./lib/db";
import { legacyIsOwner } from "./lib/roles";
import { buildPublishedCollection, type LoadedCollection } from "./lib/publishedCollection";
import { createCollectionSearch } from "./lib/collectionSearch";
import { toScoreViewModel } from "./lib/viewModels";
import type { ScoreViewModel } from "../types/viewModels";
import { FEATURE_FLAG_COLLAB_FLOW } from "./featureFlags";
import {
  CollectionContext,
  type CollectionStatus,
} from "./useCollectionContext";

const CADERNIN_UID = import.meta.env.VITE_CADERNIN_UID;

async function loadPublishedCollection(): Promise<LoadedCollection> {
  const [projects, lineage] = await Promise.all([getAllProjects(), getAllScores()]);
  return buildPublishedCollection(projects, lineage, getScoreRevision);
}

async function loadCollection(): Promise<LoadedCollection> {
  if (FEATURE_FLAG_COLLAB_FLOW) {
    return loadPublishedCollection();
  }
  const [projectDocs, songDocs, revisionDocs] = await Promise.all([
    getAllProjects(),
    getAllScores(),
    getLatestScoreRevisions(),
  ]);

  const filteredProjectDocs = projectDocs.filter(
    (p) => CADERNIN_UID && legacyIsOwner(p, CADERNIN_UID),
  );

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

  return { allScores: scores, searchScores: scores };
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CollectionStatus>("loading");
  const [allScores, setAllScores] = useState<ScoreViewModel[]>([]);
  const [searchScores, setSearchScores] = useState<ScoreViewModel[]>([]);
  const { search, getMatches } = useMemo(() => createCollectionSearch(searchScores), [searchScores]);

  useEffect(() => {
    loadCollection()
      .then((collection) => {
        setAllScores(collection.allScores);
        setSearchScores(collection.searchScores);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("loadCollection failed", err);
        setStatus("error");
      });
  }, []);

  return (
    <CollectionContext.Provider value={{ status, allScores, search, getMatches }}>
      {children}
    </CollectionContext.Provider>
  );
}
