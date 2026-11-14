import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const { handlers, exportScoreFolder } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  exportScoreFolder: vi.fn(),
}));
vi.mock("electron", () => ({
  ipcMain: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) },
  dialog: { showOpenDialog: vi.fn() },
  shell: {},
}));
vi.mock("../scripts/lib/mscz", () => ({
  autolocateMscore: () => "/mscore",
  validateMscore: () => true,
}));
vi.mock("./settings", () => ({ getMscorePath: () => "/mscore", setMscorePath: vi.fn() }));
vi.mock("../scripts/lib/exportScore", () => ({ exportScoreFolder }));
import { registerIpc } from "./ipc";

const directories: string[] = [];
afterEach(() => {
  directories.forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
  directories.length = 0;
  vi.clearAllMocks();
});

describe("export flow", () => {
  it("exports without a destination picker into a fresh temporary folder per attempt", () => {
    registerIpc();
    exportScoreFolder.mockImplementation((options) => {
      expect(fs.statSync(options.destinationDirectory).isDirectory()).toBe(true);
      directories.push(options.destinationDirectory);
      return { directory: options.destinationDirectory, files: ["score.mscz"] };
    });
    const run = handlers.get("score:runExport")!;
    for (let i = 0; i < 2; i++) {
      expect(run(null, { msczPath: "/score.mscz" })).toMatchObject({ ok: true });
    }
    expect(directories[0]).not.toBe(directories[1]);
  });

  it("removes temporary output when export fails", () => {
    registerIpc();
    let directory = "";
    exportScoreFolder.mockImplementation((options) => {
      directory = options.destinationDirectory;
      directories.push(directory);
      throw new Error("export failed");
    });
    expect(handlers.get("score:runExport")!(null, { msczPath: "/score.mscz" })).toMatchObject({ ok: false });
    expect(directory).not.toBe("");
    expect(fs.existsSync(directory)).toBe(false);
  });
});
