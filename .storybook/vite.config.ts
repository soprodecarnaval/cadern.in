import { defineConfig } from "vite";

export default defineConfig({ envDir: ".storybook", envPrefix: "STORYBOOK_", esbuild: { jsx: "automatic" } });
