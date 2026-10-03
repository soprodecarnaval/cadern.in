import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isMscoreMutexCrash,
  withIsolatedMscoreEnvironment,
} from "./mscoreEnvironment";

describe("withIsolatedMscoreEnvironment", () => {
  it("provides isolated config and data directories and removes them", () => {
    let configDirectory = "";
    let dataDirectory = "";

    const result = withIsolatedMscoreEnvironment((environment) => {
      configDirectory = environment.XDG_CONFIG_HOME ?? "";
      dataDirectory = environment.XDG_DATA_HOME ?? "";
      expect(fs.statSync(configDirectory).isDirectory()).toBe(true);
      expect(fs.statSync(dataDirectory).isDirectory()).toBe(true);
      return "metadata";
    });

    expect(result).toBe("metadata");
    expect(fs.existsSync(configDirectory)).toBe(false);
    expect(fs.existsSync(dataDirectory)).toBe(false);
  });

  it("removes the directories when MuseScore fails", () => {
    let configDirectory = "";

    expect(() =>
      withIsolatedMscoreEnvironment((environment) => {
        configDirectory = environment.XDG_CONFIG_HOME ?? "";
        throw new Error("MuseScore failed");
      }),
    ).toThrow("MuseScore failed");
    expect(fs.existsSync(configDirectory)).toBe(false);
  });
});

describe("isMscoreMutexCrash", () => {
  it("matches only the known MuseScore shutdown failure", () => {
    expect(
      isMscoreMutexCrash({
        signal: "SIGABRT",
        stderr: Buffer.from("mutex lock failed"),
      }),
    ).toBe(true);
    expect(
      isMscoreMutexCrash({ signal: "SIGABRT", stderr: "other crash" }),
    ).toBe(false);
  });
});
