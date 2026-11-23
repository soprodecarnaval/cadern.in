// Lazy entry point to the browser-score library. Only the send and reformat
// screens use it, through this dynamic import, so the engine stays out of the
// main bundle. The assets are built into /browser-score/ by
// scripts/browserScore/assets.mjs (prebuild / predev).
import type { LibraryOptions, ScoreLibrary } from "./browserScore/types";

export const BROWSER_SCORE_PATH = "/browser-score/";

export const browserScoreAssets = (
  origin: string = window.location.origin,
): LibraryOptions["assets"] => ({
  manifestUrl: new URL(`${BROWSER_SCORE_PATH}manifest.json`, origin),
  workerUrl: new URL(`${BROWSER_SCORE_PATH}worker.js`, origin),
});

export async function loadScoreLibrary(
  options: Partial<Omit<LibraryOptions, "adapter" | "assets">> = {},
): Promise<ScoreLibrary> {
  const { createScoreLibrary } = await import("./browserScore");
  return createScoreLibrary({
    adapter: "webmscore-1.2.1",
    execution: "worker",
    assets: browserScoreAssets(),
    ...options,
  });
}
