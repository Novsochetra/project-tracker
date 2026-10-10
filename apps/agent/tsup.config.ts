import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/mcp.ts', 'src/cli.ts', 'src/promptTool.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  splitting: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  // The workspace packages export TypeScript source, so they must be bundled.
  noExternal: [/^@tracker\//],
});
