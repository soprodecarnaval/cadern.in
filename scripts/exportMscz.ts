/**
 * exportMscz.ts
 *
 * Exports assets (SVG, MIDI, metajson) from a single .mscz file using MuseScore.
 * Generated files are placed alongside the .mscz file in the same directory.
 *
 * Usage:
 *   tsx scripts/exportMscz.ts <file.mscz> [--force]
 *
 * Arguments:
 *   file.mscz  Path to the .mscz file to export (required)
 *   --force    Re-export assets even if they already exist
 */

import fs from "fs";
import path from "path";
import { detectMscore, generateAssets, exportScoreAssets, ExportOptions } from "./lib/mscz";

function parseArgs(argv: string[]): { msczPath: string; force: boolean } {
  const args = argv.slice(2);
  let msczPath: string | undefined;
  let force = false;

  for (const arg of args) {
    if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (!arg.startsWith("-")) {
      msczPath = arg;
    }
  }

  if (!msczPath) {
    console.error("Usage: tsx scripts/exportMscz.ts <file.mscz> [--force]");
    process.exit(1);
  }

  const resolved = path.resolve(msczPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: file not found: ${resolved}`);
    process.exit(1);
  }
  if (!resolved.endsWith(".mscz")) {
    console.error(`Error: expected a .mscz file, got: ${resolved}`);
    process.exit(1);
  }

  return { msczPath: resolved, force };
}

async function main(): Promise<void> {
  const { msczPath, force } = parseArgs(process.argv);
  const folderPath = path.dirname(msczPath);

  const mscore = detectMscore();
  console.log(`Using MuseScore: ${mscore}`);
  if (force) console.log("Force: re-exporting existing assets");
  console.log("");

  const opts: ExportOptions = { force };
  exportScoreAssets(mscore, folderPath, opts);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
