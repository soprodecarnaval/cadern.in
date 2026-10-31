import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  onProjectWritten,
  onScoreWritten,
  onSongbookWritten,
} from "./publishedScores";

initializeApp();

// Same region as Firestore (firebase.json). `maxInstances` caps cost under
// unexpected traffic; override per function where needed.
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

export { findUserForInvite } from "./findUserForInvite";
export { swapSongbookEntryToFork } from "./swapSongbookEntry";

// Keep scores.published in sync (collab-flow §2.2.1). The handlers ignore
// writes to `published` itself, so their own updates don't loop.
export const syncPublishedScoresOnSongbook = onDocumentWritten(
  "songbooks/{songbookId}",
  async (event) => {
    await onSongbookWritten(getFirestore(), event.params.songbookId,
      event.data?.before.data(), event.data?.after.data());
  },
);

export const syncPublishedScoresOnScore = onDocumentWritten(
  "scores/{scoreId}",
  async (event) => {
    await onScoreWritten(getFirestore(), event.params.scoreId,
      event.data?.before.data(), event.data?.after.data());
  },
);

export const syncPublishedScoresOnProject = onDocumentWritten(
  "projects/{projectId}",
  async (event) => {
    await onProjectWritten(getFirestore(), event.params.projectId,
      event.data?.before.data(), event.data?.after.data());
  },
);
