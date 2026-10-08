import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDatabase, isPostgresUrl } from './db/createDatabase';
import { migrateToLatest } from './db/migrator';
import { createBroadcaster } from './events/broadcaster';
import { removeStalePendingAttachments } from './services/attachments';
import { createDiskStorage } from './storage/diskStorage';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
await migrateToLatest(db);

const storage = createDiskStorage(config.uploadsDir);
const removed = await removeStalePendingAttachments({ db, storage }, Date.now());
if (removed > 0) console.log(`Removed ${removed} unused upload(s).`);

const app = createApp({
  db,
  storage,
  events: createBroadcaster(),
  token: config.token,
  webDist: config.webDist,
  testReset: config.testReset,
  repoRoot: config.repoRoot,
  version: config.version,
  publicUrl: config.publicUrl,
});

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  const database = isPostgresUrl(config.databaseUrl) ? 'Postgres' : config.databaseUrl;
  console.log(`Tracker API on http://${config.host}:${info.port} (database: ${database})`);
  if (config.token) console.log('Access token required.');
  if (config.publicUrl) console.log(`Agents connect at ${config.publicUrl}`);
  if (config.testReset) console.log('Test reset route enabled: POST /api/test/reset');
});

function shutdown(): void {
  // Open SSE streams would keep close() waiting forever.
  if ('closeAllConnections' in server) server.closeAllConnections();
  server.close();
  void db.destroy().finally(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
