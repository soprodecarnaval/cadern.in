import {
  getDocs,
  collection,
  collectionGroup,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { storagePathToUrl } from "./storage.js";
import { zSongDoc, zProjectDoc, zRevisionDoc } from "../firestore-types.js";
import type { Collection, Score, Part } from "../types.js";

function toUrl(path: string): string {
  return storagePathToUrl(path);
}

async function loadCollection(): Promise<Collection> {
  const [projectsSnap, songsSnap, revisionsSnap] = await Promise.all([
    getDocs(collection(db, "projects")),
    getDocs(collection(db, "songs")),
    getDocs(query(collectionGroup(db, "revisions"), where("isLatest", "==", true))),
  ]);

  const projectTitles = new Map(
    projectsSnap.docs.map((d) => [d.id, zProjectDoc.parse(d.data()).title])
  );

  // Map revisions by songId (parent doc id)
  const revisionsBySongId = new Map(
    revisionsSnap.docs.map((d) => {
      const songId = d.ref.parent.parent!.id;
      return [songId, zRevisionDoc.parse(d.data())];
    })
  );

  const scoresByProject = new Map<string, Score[]>();

  for (const songDoc of songsSnap.docs) {
    const song = zSongDoc.parse(songDoc.data());
    const revision = revisionsBySongId.get(songDoc.id);
    if (!revision) continue;

    const parts: Part[] = revision.parts.map((p) => ({
      ...p,
      svg: p.svg.map(toUrl),
      midi: toUrl(p.midi),
    }));

    const score: Score = {
      id: songDoc.id,
      title: song.title,
      composer: song.composer,
      sub: song.sub,
      tags: song.tags,
      projectTitle: projectTitles.get(song.projectId) ?? song.projectId,
      mscz: toUrl(revision.mscz),
      metajson: toUrl(revision.metajson),
      midi: toUrl(revision.midi),
      parts,
    };

    const existing = scoresByProject.get(song.projectId) ?? [];
    existing.push(score);
    scoresByProject.set(song.projectId, existing);
  }

  const projects = Array.from(scoresByProject.entries()).map(([projectId, scores]) => ({
    title: projectTitles.get(projectId) ?? projectId,
    scores,
  }));

  return { projects, version: 3 };
}

const collection_ = await loadCollection();
export default collection_;
