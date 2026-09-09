import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const withIsolatedMscoreEnvironment = <T>(
  run: (environment: NodeJS.ProcessEnv) => T,
): T => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cadernin-mscore-"),
  );
  const configDirectory = path.join(directory, "config");
  const dataDirectory = path.join(directory, "data");
  fs.mkdirSync(configDirectory);
  fs.mkdirSync(dataDirectory);

  try {
    return run({
      ...process.env,
      XDG_CONFIG_HOME: configDirectory,
      XDG_DATA_HOME: dataDirectory,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};
