import { useCallback, useEffect, useState, ReactNode } from "react";
import Fuse, { IFuseOptions } from "fuse.js";
import { getAllProjects, getAllScores, getLatestRevisions } from "./lib/db";
import { isOwner } from "./lib/roles";
import type {
  ScoreViewModel,
  RevisionViewModel,
  PartViewModel,
} from "../types/viewModels";
import { FEATURE_FLAG_AUTH_ENABLED } from "./featureFlags";
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
    getLatestRevisions(),
  ]);

  console.log(songDocs.length);

  const filteredProjectDocs = FEATURE_FLAG_AUTH_ENABLED
    ? projectDocs
    : projectDocs.filter((p) => CADERNIN_UID && isOwner(p, CADERNIN_UID));

  const projectTitles = new Map(
    filteredProjectDocs.map((p) => [p.id, p.title]),
  );

  const revisionsByScoreId = new Map(revisionDocs.map((r) => [r.scoreId, r]));

  const scores: ScoreViewModel[] = [];

  for (const song of songDocs) {
    if (song.deletedAt) {
      continue;
    }
    const revision = revisionsByScoreId.get(song.id);
    if (!revision) {
      continue;
    }

    const parts: PartViewModel[] = revision.parts.map((p) => ({
      ...p,
      svg: p.svg.map((f) => f.url),
      midi: p.midi.url,
    }));

    const latestRevision: RevisionViewModel = {
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      uploadedBy: revision.uploadedBy,
      uploadedAt: revision.uploadedAt,
      mscz: revision.mscz.url,
      metajson: revision.metajson.url,
      midi: revision.midi.url,
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
