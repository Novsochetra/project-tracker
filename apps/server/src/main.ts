import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDatabase, isPostgresUrl } from './db/createDatabase';
import { migrateToLatest } from './db/migrator';
import { createBroadcaster } from './events/broadcaster';
import { REQUEST_TIMEOUT_MS, endSlowRequests, isUploadRequest } from './http/slowRequests';
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

// Node gives a whole request five minutes and then answers 408, which cut off a 100 MB video sent
// slower than 2.8 Mbit/s. An hour lets the largest file arrive at 240 kbit/s, slower than a weak
// phone uplink. Other requests keep the five minutes (endSlowRequests), and headers keep Node's one
// minute, so a client that never sends them is still dropped.
const UPLOAD_TIMEOUT_MS = 60 * 60 * 1000;

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
    serverOptions: { requestTimeout: UPLOAD_TIMEOUT_MS },
  },
  (info) => {
    const database = isPostgresUrl(config.databaseUrl) ? 'Postgres' : config.databaseUrl;
    console.log(`Tracker API on http://${config.host}:${info.port} (database: ${database})`);
    if (config.token) console.log('Access token required.');
    if (config.publicUrl) console.log(`Agents connect at ${config.publicUrl}`);
    if (config.testReset) console.log('Test reset route enabled: POST /api/test/reset');
  },
);

endSlowRequests(server as Server, REQUEST_TIMEOUT_MS, isUploadRequest);

function shutdown(): void {
  // Open SSE streams would keep close() waiting forever.
  if ('closeAllConnections' in server) server.closeAllConnections();
  server.close();
  void db.destroy().finally(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
