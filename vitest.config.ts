import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'web/dist/**'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: 4,
  },
});
