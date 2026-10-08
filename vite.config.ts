/// <reference types="vitest" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { loadAppEnv } from "./vite.env";

export default defineConfig(({ mode }) => {
  const { define } = loadAppEnv(mode, process.cwd());

  return {
    plugins: [react()],
    build: {
      target: "esnext",
    },
    define,
    test: {
      // Need the emulators; run with `npm run test:rules`.
      exclude: [...configDefaults.exclude, "tests/rules/**"],
    },
  };
});
