/**
 * seedFromFolder.ts
 *
 * Full seed pipeline: takes a local collection folder with .mscz files and
 * exports assets, indexes the collection, then uploads everything to Firebase.
 *
 * Expected input structure:
 *   <input>/
 *     <project>/
 *       <song>/
 *         <song>.mscz
 *
 * Pipeline:
 *   1. Export assets: generate SVG, MIDI, and metajson for each .mscz via MuseScore
 *   2. Index collection: validate assets, copy to output folder, write collection.json
 *   3. Firebase upload: upload assets to Cloud Storage and index in Firestore
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/seedFromFolder.ts --input <folder> [options]
 *
 * Options:
 *   --input <folder>   Root collection folder containing .mscz files (required)
 *   --output <folder>  Output folder for indexed assets (default: temp directory)
 *   --force            Re-export all assets even if they already exist
 *   --clean            Remove orphaned Firebase docs and storage files at the end
 *
 * Required environment variables (via .env.local):
 *   CADERN_IN_UID    Firebase UID of the user responsible for the upload
 *   STORAGE_BUCKET   Cloud Storage bucket name
 */

import fs from "fs";
import path from "path";
import os from "os";
import { LegacyCollection } from "../types";
import { detectMscore, exportCollectionAssets, ExportOptions } from "./lib/mscz";
import { indexCollection } from "./lib/indexCollection";
import { seedToFirebase } from "./lib/firebase";

// --- Validação de variáveis de ambiente ---

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// --- Parsing de argumentos ---

interface SeedArgs {
  input: string;
  output: string;
  force: boolean;
  clean: boolean;
}

function parseArgs(argv: string[]): SeedArgs {
  const args = argv.slice(2);
  let input: string | undefined;
  let output: string | undefined;
  let force = false;
  let clean = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      input = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[++i];
    } else if (args[i] === "--force" || args[i] === "-f") {
      force = true;
    } else if (args[i] === "--clean") {
      clean = true;
    }
  }

  if (!input) {
    console.error(
      "Usage: tsx --env-file=.env.local scripts/seedFromFolder.ts --input <folder> [--output <folder>] [--force] [--clean]"
    );
    process.exit(1);
  }

  const resolvedInput = path.resolve(input);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: input folder not found: ${resolvedInput}`);
    process.exit(1);
  }

  const resolvedOutput = output
    ? path.resolve(output)
    : fs.mkdtempSync(path.join(os.tmpdir(), "cadern-seed-"));

  return { input: resolvedInput, output: resolvedOutput, force, clean };
}

// --- Pipeline ---

async function main(): Promise<void> {
  const uid = requireEnv("CADERN_IN_UID");
  const storageBucket = requireEnv("STORAGE_BUCKET");

  const { input, output, force, clean } = parseArgs(process.argv);

  console.log("=== cadern.in seed ===");
  console.log(`Input:  ${input}`);
  console.log(`Output: ${output}`);
  if (force) console.log("Force: re-exporting all assets");
  if (clean) console.log("Clean: orphaned Firebase docs will be removed");
  console.log("");

  // --- Etapa 1: exportar assets via MuseScore ---

  console.log("--- Step 1/3: Exporting assets ---");
  const mscore = detectMscore();
  console.log(`Using MuseScore: ${mscore}\n`);
  const exportOpts: ExportOptions = { force };
  exportCollectionAssets(mscore, input, exportOpts);
  console.log("\nStep 1 complete.\n");

  // --- Etapa 2: indexar coleção e copiar assets para pasta de saída ---

  console.log("--- Step 2/3: Indexing collection ---");
  if (fs.existsSync(output)) {
    fs.rmSync(output, { recursive: true });
  }
  fs.mkdirSync(output, { recursive: true });
  console.log(`Indexing '${input}' -> '${output}'...`);
  const warnings = indexCollection(input, output);
  if (warnings.length > 0) {
    const warningsPath = path.join(output, "warnings.json");
    console.warn(`\n${warnings.length} warning(s) found. Written to: ${warningsPath}`);
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
  }
  console.log("\nStep 2 complete.\n");

  // --- Etapa 3: upload para Firebase ---

  console.log("--- Step 3/3: Uploading to Firebase ---");
  const collectionJson = fs.readFileSync(path.join(output, "collection.json"), "utf-8");
  const collection = JSON.parse(collectionJson) as LegacyCollection;
  await seedToFirebase(output, collection, { uid, storageBucket }, { clean });
  console.log("\nStep 3 complete.\n");

  console.log("=== Seed complete ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
