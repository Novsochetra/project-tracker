import { defineConfig } from 'tsup';

export default defineConfig({
  // Each sits right in dist/, one level below the package root, as config.ts expects.
  // db.js runs migrations: node apps/server/dist/db.js migrate, a deploy's pre-deploy step.
  entry: { main: 'src/main.ts', 'owner-set': 'src/cli/setOwner.ts', db: 'src/db/cli.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@tracker\//],
  external: ['better-sqlite3', 'pg'],
});
