import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tracker/agent',
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
