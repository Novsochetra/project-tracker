import { defineConfig } from 'tsup';
import { rootVersionOnly } from '../../scripts/build/rootVersionOnly';

export default defineConfig({
  // Each sits right in dist/, one level below the package root, as config.ts expects.
  // db.js runs migrations: node apps/server/dist/db.js migrate, a deploy's pre-deploy step.
  // data-move.js copies a local tracker into Postgres and S3 once (docs/deploy-railway.md).
  entry: {
    main: 'src/main.ts',
    'owner-set': 'src/cli/setOwner.ts',
    db: 'src/db/cli.ts',
    'data-move': 'src/cli/moveData.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@tracker\//],
  esbuildPlugins: [rootVersionOnly()],
  external: ['better-sqlite3', 'pg'],
});
