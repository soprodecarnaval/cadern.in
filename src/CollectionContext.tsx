import { useCallback, useEffect, useState, ReactNode } from "react";
import {
  getDocs,
  collection,
  collectionGroup,
  query,
  where,
} from "firebase/firestore";
import Fuse, { IFuseOptions } from "fuse.js";
import { db } from "./firebase";
import { storagePathToUrl } from "./storage";
import { zSongDoc, zProjectDoc, zRevisionDoc } from "../firestore-types";
import type { Collection, Score, Part } from "../types";
import {
  CollectionContext,
  type CollectionStatus,
} from "./useCollectionContext";

async function loadCollection(): Promise<Collection> {
  const [projectsSnap, songsSnap, revisionsSnap] = await Promise.all([
    getDocs(collection(db, "projects")),
    getDocs(collection(db, "songs")),
    getDocs(
      query(collectionGroup(db, "revisions"), where("isLatest", "==", true)),
    ),
  ]);

  const projectTitles = new Map(
    projectsSnap.docs.map((d) => [d.id, zProjectDoc.parse(d.data()).title]),
  );

  const revisionsBySongId = new Map(
    revisionsSnap.docs.map((d) => {
      const songId = d.ref.parent.parent!.id;
      return [songId, zRevisionDoc.parse(d.data())];
    }),
  );

  const scoresByProject = new Map<string, Score[]>();

  for (const songDoc of songsSnap.docs) {
    const song = zSongDoc.parse(songDoc.data());
    if (song.deletedAt) continue;
    const revision = revisionsBySongId.get(songDoc.id);
    if (!revision) continue;

    const parts: Part[] = revision.parts.map((p) => ({
      ...p,
      svg: p.svg.map(storagePathToUrl),
      midi: storagePathToUrl(p.midi),
    }));

    const score: Score = {
      id: songDoc.id,
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

const fuseOptions: IFuseOptions<Score> = {
  keys: ["title", "composer", "tags", "projectTitle"],
  includeScore: true,
  shouldSort: true,
  threshold: 0.1,
  useExtendedSearch: true,
  ignoreDiacritics: true,
  ignoreLocation: true,
};

function buildFuse(scores: Score[]): Fuse<Score> {
  const index = Fuse.createIndex(fuseOptions.keys as string[], scores);
  return new Fuse(scores, fuseOptions, index);
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CollectionStatus>("loading");
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [fuse, setFuse] = useState<Fuse<Score> | null>(null);

  useEffect(() => {
    loadCollection()
      .then((col) => {
        const scores = col.projects.flatMap((p) => p.scores);
        setAllScores(scores);
        setFuse(buildFuse(scores));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const search = useCallback(
    (query: string): Score[] => {
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
