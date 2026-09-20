/**
 * backfillMetajson.ts
 *
 * Upgrades an exported folder's .metajson to v2, so it still uploads once the
 * web app stops inferring part names from filenames.
 *
 * Usage:
 *   tsx scripts/backfillMetajson.ts <folder> [--write]
 *
 * Dry by default; pass --write to replace the .metajson in place.
 */

import fs from "node:fs";
import path from "node:path";
import { buildMetajson } from "./lib/backfillMetajson";

function parseArgs(argv: string[]): { folder: string; write: boolean } {
  const args = argv.slice(2);
  const folder = args.find((a) => !a.startsWith("--"));
  if (!folder) {
    throw new Error("Usage: tsx scripts/backfillMetajson.ts <folder> [--write]");
  }
  return { folder, write: args.includes("--write") };
}

async function main(): Promise<void> {
  const { folder, write } = parseArgs(process.argv);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    throw new Error(`Not a directory: ${folder}`);
  }

  const { metajson, warnings } = buildMetajson(folder);
  const existing = fs
    .readdirSync(folder)
    .find((name) => name.endsWith(".metajson"));
  const target = path.join(folder, existing ?? "score.metajson");

  console.log(`${metajson.parts.length} parts:`);
  for (const part of metajson.parts) {
    console.log(`  ${part.instrument.padEnd(13)} ${JSON.stringify(part.name)}`);
  }
  for (const warning of warnings) {
    console.warn(`  ! ${warning}`);
  }

  if (!write) {
    console.log(`\nDRY RUN — pass --write to replace ${path.basename(target)}`);
    console.log(JSON.stringify(metajson, null, 2));
    return;
  }

  fs.writeFileSync(target, JSON.stringify(metajson, null, 2));
  console.log(`\nwrote ${target}`);
}

void main();
