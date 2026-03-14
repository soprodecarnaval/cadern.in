import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'test/e2e/**',
      'test/scripts/**',
    ],
  },
});
