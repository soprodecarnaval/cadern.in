import type { Migration } from "../lib/migration";
import songsToScores from "./202604201809_songs_to_scores";
import projectsRoles from "./202604201900_projects_roles";
import songbooksProjectId from "./202604201901_songbooks_projectid";
import storageDownloadUrls from "./202604271800_storage_download_urls";
import partNames from "./202609201500_part_names";
import scoreRevisionsSubcollection from "./202610041500_score_revisions_subcollection";

export const migrations: Migration[] = [
  songsToScores,
  projectsRoles,
  songbooksProjectId,
  storageDownloadUrls,
  partNames,
  scoreRevisionsSubcollection,
];
