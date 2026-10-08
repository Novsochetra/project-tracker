import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    name: '@tracker/web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    // Well above the 5s one wait for the screen may take (test/setup.ts), so a stuck wait reports
    // what it was waiting for instead of a bare test timeout.
    testTimeout: 15_000,
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
