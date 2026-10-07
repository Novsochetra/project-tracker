import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tracker/client',
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
