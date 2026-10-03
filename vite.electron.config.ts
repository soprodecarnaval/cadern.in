import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import electron from "vite-plugin-electron/simple";
import path from "node:path";
import { loadAppEnv } from "./vite.env";

const repoRoot = __dirname;

// Dedicated build for the Electron export app. Independent of the website's
// vite.config.ts so the site bundle never pulls in electron.
export default defineConfig(({ mode }) => {
  const { define } = loadAppEnv(mode, repoRoot);

  return {
  root: path.resolve(repoRoot, "src/export-app"),
  // `root` is src/export-app, but the .env files live at the repo root, and
  // envDir defaults to `root` — without this the app builds with no Firebase
  // config at all.
  envDir: repoRoot,
  define,
  plugins: [
    react(),
    electron({
      // root is src/export-app, so pin main/preload output to the repo-root
      // dist-electron/ that package.json#main and main.ts expect.
      main: {
        entry: path.resolve(repoRoot, "electron/main.ts"),
        vite: { build: { outDir: path.resolve(repoRoot, "dist-electron") } },
      },
      preload: {
        input: path.resolve(repoRoot, "electron/preload.ts"),
        vite: { build: { outDir: path.resolve(repoRoot, "dist-electron") } },
      },
    }),
  ],
  server: {
    // Allow importing shared code from src/ and scripts/ (outside the app root).
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: path.resolve(repoRoot, "dist-export-app"),
    emptyOutDir: true,
    target: "esnext",
  },
  };
});
