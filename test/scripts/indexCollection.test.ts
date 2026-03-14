import fs from "fs";
import fsp from "fs/promises";
import crypto from "crypto";
import path from "path";
import { Collection } from "../../types";
import indexCollection from "../../scripts/indexCollection";
import { describe, it, expect } from "vitest";

const inputDir = "public/collection";
const outputDir = "test/scripts/indexCollectionTestOutput";

const getChecksum = (file: string) => {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
};

const expectEqualFiles = (file1: string, file2: string) => {
  expect(getChecksum(file1)).toEqual(getChecksum(file2));
};
const expectEqualDirs = (dir1: string, dir2: string, skip: Set<string>) => {
  const files1 = fs
    .readdirSync(dir1)
    .filter((file) => !skip.has(file))
    .sort();
  const files2 = fs
    .readdirSync(dir2)
    .filter((file) => !skip.has(file))
    .sort();

  expect(files1).toEqual(files2);

  files1.forEach((file) => {
    const path1 = path.join(dir1, file);
    const path2 = path.join(dir2, file);

    const stat1 = fs.statSync(path1);
    if (stat1.isDirectory()) {
      expectEqualDirs(path1, path2, skip);
    } else {
      expectEqualFiles(path1, path2);
    }
  });
};

// do some things to ensure comparison works:
// - sort projects by title
// - sort scores by title
// - sort parts by name
// - sort tags
// - set sortedAt to the same value
const makeCollectionComparable = (inputCollection: Collection) => {
  inputCollection.projects.sort((a, b) => a.title.localeCompare(b.title));
  inputCollection.projects.forEach((project) => {
    project.scores.sort((a, b) => a.title.localeCompare(b.title));
    project.scores.forEach((score) => {
      score.tags.sort();
      score.parts.sort((a, b) => a.name.localeCompare(b.name));
    });
  });
};

const assertCollectionEquality = (
  inputCollection: Collection,
  outputCollection: Collection,
) => {
  makeCollectionComparable(inputCollection);
  makeCollectionComparable(outputCollection);

  expect(inputCollection.projects.length).toEqual(
    outputCollection.projects.length,
  );

  // assert project by project to get better error messages
  for (let i = 0; i < inputCollection.projects.length; i++) {
    const inputProject = inputCollection.projects[i];
    const outputProject = outputCollection.projects[i];
    expect(outputProject.title).toEqual(inputProject.title);
    expect(outputProject.scores.map((s) => s.title)).toEqual(
      inputProject.scores.map((s) => s.title),
    );

    // assert score by score to get better error messages
    for (let j = 0; j < inputProject.scores.length; j++) {
      const inputScore = inputProject.scores[j];
      const outputScore = outputProject.scores[j];
      expect(outputScore).toEqual(inputScore);

      // assert part by part to get better error messages
      for (let k = 0; k < inputScore.parts.length; k++) {
        const inputPart = inputScore.parts[k];
        const outputPart = outputScore.parts[k];
        expect(outputPart).toEqual(inputPart);
      }
    }
  }
};

const compareCollections = (inputDir: string, outputDir: string) => {
  // compare file structure recursively
  const skip = new Set(["collection.json", ".DS_Store", "warnings.json"]);
  expectEqualDirs(inputDir, outputDir, skip);

  // compare collection.json
  const inputCollectionPath = path.join(inputDir, "collection.json");
  const outputCollectionPath = path.join(outputDir, "collection.json");

  const inputCollection = JSON.parse(
    fs.readFileSync(inputCollectionPath, "utf-8"),
  ) as Collection;
  const outputCollection = JSON.parse(
    fs.readFileSync(outputCollectionPath, "utf-8"),
  ) as Collection;

  assertCollectionEquality(inputCollection, outputCollection);
};

describe("indexCollection", () => {
  it("should be idempotent", () => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    indexCollection(["--input", inputDir, "--output", outputDir]);
    compareCollections(inputDir, outputDir);
  });

  it("should copy tags from an existing collection in the output directory", async () => {
    // copy over the entire input collection to the output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.cpSync(inputDir, outputDir, { recursive: true });

    // make another copy that will serve as the input collection without tags
    const inputDirNoTags = "test/scripts/indexCollectionTestInputNoTags";
    fs.cpSync(inputDir, inputDirNoTags, { recursive: true });
    fs.rmSync(path.join(inputDirNoTags, "collection.json"));

    // remove tags from all .metajson files in that noTags dir
    const metajsonFiles = fs
      .readdirSync(inputDirNoTags, { withFileTypes: true })
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith(".metajson"));

    await Promise.all(
      metajsonFiles.map((dirent) => {
        const metajsonPath = path.join(inputDirNoTags, dirent.name);
        const metajson = JSON.parse(fs.readFileSync(metajsonPath, "utf-8"));
        delete metajson.tags;
        return fsp.writeFile(metajsonPath, JSON.stringify(metajson, null, 2));
      }),
    );

    // run indexCollection with the noTags dir
    indexCollection(["--input", inputDirNoTags, "--output", outputDir]);

    // compare the result with the original collection
    compareCollections(inputDir, outputDir);
  });
});
