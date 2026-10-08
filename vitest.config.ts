import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/shared',
      'packages/client',
      'apps/server',
      'apps/agent',
      'apps/web',
      { test: { name: 'eslint-rules', environment: 'node', include: ['eslint/**/*.test.ts'] } },
    ],
  },
});
