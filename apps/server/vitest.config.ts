import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tracker/server',
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
