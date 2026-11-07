import { defineConfig } from "vitest/config";

// Runs against the Firebase emulators started by `npm run test:rules`; the
// `demo-` project id keeps the tests off every real project.
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    // Tests share one emulator instance and clear it between cases.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
