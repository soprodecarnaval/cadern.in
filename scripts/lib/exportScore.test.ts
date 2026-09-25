import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  buildPartBasenames,
  collectPartFiles,
  safeFilename,
  exportScoreFolder,
} from "./exportScore";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

describe("exportScore", () => {
  it("exports into the score basename folder and detects collisions there", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "export-folder-test-"));
    vi.mocked(execFileSync).mockImplementation(((_command: string, args: string[]) => {
      const argumentsList = args;
      if (argumentsList.includes("--score-parts")) {
        return JSON.stringify({ parts: ["Trumpet"], partsBin: [""] });
      }
      const jobs = JSON.parse(fs.readFileSync(argumentsList[2], "utf8")) as
        Array<{ out: string | string[] }>;
      for (const job of jobs) {
        for (const output of [job.out].flat()) {
          fs.writeFileSync(output, "generated asset");
        }
      }
      return Buffer.alloc(0);
    }) as typeof execFileSync);
    try {
      const options = {
        mscorePath: "mscore",
        msczPath: "test-scores/all-instruments.mscz",
        title: "Canção: teste",
        selectedParts: [{ id: "1", name: "Trumpet", scoreIndex: 0, instrument: "trompete" as const }],
        metadata: { title: "Canção: teste", composer: "", previousSource: "", poet: "" },
        destinationDirectory: directory,
      };
      const result = exportScoreFolder(options);
      expect(result.directory).toBe(path.join(directory, "Canção- teste"));
      expect(fs.readdirSync(directory)).toEqual(["Canção- teste"]);
      expect(fs.readdirSync(result.directory).sort()).toEqual(result.files);
      expect(result.files).toContain("Canção- teste.mscz");
      expect(() => exportScoreFolder(options)).toThrow(/Destination already has/);
      expect(exportScoreFolder({ ...options, overwrite: true })).toEqual(result);
    } finally {
      vi.mocked(execFileSync).mockReset();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("preserves Unicode while replacing unsafe filename characters", () => {
    expect(safeFilename('Olha pro Céu: "Prática"')).toBe(
      "Olha pro Céu- -Prática-",
    );
  });

  it("gives duplicate instruments stable non-numeric suffixes", () => {
    const names = buildPartBasenames("Marcha", [
      { id: "10", name: "Trumpet 1", scoreIndex: 0, instrument: "trompete" },
      { id: "20", name: "Trombone", scoreIndex: 1, instrument: "trombone" },
      { id: "30", name: "Trumpet 2", scoreIndex: 2, instrument: "trompete" },
    ]);

    expect(names.get("10")).toBe("Marcha-trompete-a");
    expect(names.get("20")).toBe("Marcha-trombone");
    expect(names.get("30")).toBe("Marcha-trompete-b");
  });
});

describe("collectPartFiles", () => {
  it("orders pages numerically, not lexically", () => {
    const files = [
      "Marcha-trompete-10.svg",
      "Marcha-trompete-2.svg",
      "Marcha-trompete-1.svg",
      "Marcha-trompete.midi",
    ];

    expect(collectPartFiles(files, "Marcha-trompete")).toEqual({
      svg: [
        "Marcha-trompete-1.svg",
        "Marcha-trompete-2.svg",
        "Marcha-trompete-10.svg",
      ],
      midi: "Marcha-trompete.midi",
    });
  });

  it("accepts an unsuffixed single page", () => {
    expect(collectPartFiles(["Marcha-flauta.svg"], "Marcha-flauta").svg).toEqual([
      "Marcha-flauta.svg",
    ]);
  });

  it("does not claim pages belonging to a longer basename", () => {
    // -a and -b suffixes mean one basename can prefix another.
    const files = ["Marcha-tuba-1.svg", "Marcha-tuba eb-1.svg"];

    expect(collectPartFiles(files, "Marcha-tuba").svg).toEqual([
      "Marcha-tuba-1.svg",
    ]);
  });
});
