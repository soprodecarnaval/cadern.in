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
      exclude: [
        ...configDefaults.exclude,
        // Run these suites with the Firebase emulators.
        "tests/rules/**",
        "tests/migrations/**",
        "functions/**",
        // Run these suites with `node --test plugin/tests/*.test.mjs`.
        "plugin/tests/*.test.mjs",
      ],
    },
  };
});
