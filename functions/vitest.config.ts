import { defineConfig } from "vitest/config";

// Own config, so vitest doesn't pick up the web app's vite.config.ts above.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
