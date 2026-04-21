import type { Migration } from "../lib/migration";
import songsToScores from "./202604201809_songs_to_scores";
import projectsRoles from "./202604201900_projects_roles";
import songbooksProjectId from "./202604201901_songbooks_projectid";

export const migrations: Migration[] = [
  songsToScores,
  projectsRoles,
  songbooksProjectId,
];
