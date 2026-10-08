import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { request, type ClientRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { FILE_NAME_HEADER } from '@tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { deleteAllRows } from '../../src/repositories/reset';
import { createDiskStorage } from '../../src/storage/diskStorage';
import { createTestDatabase, DIALECTS } from '../helpers/server';

const MB = 1024 * 1024;

interface Answer {
  status: number;
  body: unknown;
}

async function waitFor(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// The server read a whole upload into memory before writing it: a 95 MB video took the API from
// 76 MB to 681 MB. Now the file goes to disk as it arrives, through a real HTTP server here.
describe.each(DIALECTS)('uploads stream to disk (%s)', (dialect) => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-streamed-'));
  let db: Db;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    db = await createTestDatabase(dialect);
    const app = createApp({ db, storage: createDiskStorage(dir), events: createBroadcaster() });
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
    await once(server, 'listening');
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.closeAllConnections();
    server.close();
    await db.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await deleteAllRows(db);
    for (const name of readdirSync(dir)) rmSync(join(dir, name));
  });

  const stored = () => readdirSync(dir);
  const storedBytes = () => stored().reduce((sum, name) => sum + statSync(join(dir, name)).size, 0);
  const rowCount = async () => (await db.selectFrom('attachments').select('id').execute()).length;

  function startUpload(headers: Record<string, string>): {
    req: ClientRequest;
    answer: Promise<Answer>;
  } {
    const req = request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/api/attachments',
      headers,
    });
    const answer = new Promise<Answer>((resolve, reject) => {
      req.on('error', reject);
      req.on('response', (res) => {
        let text = '';
        res.on('data', (chunk: Buffer) => (text += chunk.toString()));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
      });
    });
    return { req, answer };
  }

  const video = (bytes: number) => ({
    'content-type': 'video/mp4',
    'content-length': String(bytes),
    [FILE_NAME_HEADER]: 'clip.mp4',
  });

  it('writes the file as it arrives, before the request ends', async () => {
    const { req, answer } = startUpload(video(20 * MB));
    req.write(Buffer.alloc(2 * MB, 1));
    await waitFor(() => storedBytes() >= MB, 'the first bytes on disk');
    expect(storedBytes()).toBeLessThan(20 * MB);
    req.end(Buffer.alloc(18 * MB, 1));

    const { status, body } = await answer;
    expect(status).toBe(201);
    expect(body).toMatchObject({ fileName: 'clip.mp4', size: 20 * MB });
    expect(storedBytes()).toBe(20 * MB);
    expect(await rowCount()).toBe(1);
  });

  it('keeps no file and no row when the client stops sending', async () => {
    const { req, answer } = startUpload(video(20 * MB));
    answer.catch(() => undefined);
    req.write(Buffer.alloc(2 * MB, 1));
    await waitFor(() => storedBytes() >= MB, 'the first bytes on disk');
    req.destroy();

    await waitFor(() => stored().length === 0, 'the partial file to go');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await rowCount()).toBe(0);
    expect(stored()).toEqual([]);
  });

  it('answers once a file sent without a length passes its limit, keeping nothing', async () => {
    const { req, answer } = startUpload({
      'content-type': 'image/png',
      'transfer-encoding': 'chunked',
      [FILE_NAME_HEADER]: 'huge.png',
    });
    let answered = false;
    void answer.finally(() => (answered = true));
    const chunk = Buffer.alloc(MB, 1);
    for (let sent = 0; sent < 40 && !answered; sent += 1) {
      if (!req.write(chunk)) await Promise.race([once(req, 'drain'), answer]);
    }
    const { status, body } = await answer;
    req.destroy();
    expect(status).toBe(400);
    expect(body).toEqual({
      error: { code: 'invalid_input', message: 'Images can be up to 15 MB.' },
    });
    await waitFor(() => stored().length === 0, 'the partial file to go');
    expect(await rowCount()).toBe(0);
  });
});
