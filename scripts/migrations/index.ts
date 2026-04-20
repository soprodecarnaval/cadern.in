import type { Migration } from "../lib/migration";
import songsToScores from "./202604201809_songs_to_scores";

export const migrations: Migration[] = [songsToScores];
