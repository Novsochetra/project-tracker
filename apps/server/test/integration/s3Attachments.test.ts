import { once } from 'node:events';
import { request, type ClientRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { FILE_NAME_HEADER, type Attachment } from '@tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { deleteAllRows } from '../../src/repositories/reset';
import { openFileStorage } from '../../src/storage/openFileStorage';
import { addOwner } from '../helpers/auth';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { createTestDatabase } from '../helpers/server';

const MB = 1024 * 1024;
const PATTERN = Buffer.from(Array.from({ length: 251 }, (_, index) => index));
const VIDEO = Buffer.alloc(12 * MB, PATTERN);

async function waitFor(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// The whole path a phone's upload and a video player's reads take, through a real HTTP server,
// with files in S3 (a fake one, which the real AWS SDK talks to).
describe('attachments stored in S3', () => {
  let fake: FakeS3;
  let db: Db;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    fake = await startFakeS3();
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'fake-s3-key');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'fake-s3-secret');
    const config = loadConfig({
      ...process.env,
      S3_BUCKET: fake.bucket,
      S3_ENDPOINT: fake.endpoint,
      AWS_REGION: 'us-east-1',
    });
    db = await createTestDatabase('sqlite');
    const storage = await openFileStorage(config);
    const app = createApp({ db, storage, events: createBroadcaster() });
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
    await once(server, 'listening');
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    server.closeAllConnections();
    server.close();
    await db.destroy();
    await fake.close();
  });

  beforeEach(async () => {
    await deleteAllRows(db);
    fake.reset();
  });

  const rowCount = async () => (await db.selectFrom('attachments').select('id').execute()).length;
  const operations = () => fake.calls.map((call) => call.operation);
  const leftInS3 = () => fake.objects.size + fake.uploads.size;

  async function upload(bytes: Buffer, name: string, type: string): Promise<Attachment> {
    const res = await fetch(`${base}/api/attachments`, {
      method: 'POST',
      headers: { 'content-type': type, [FILE_NAME_HEADER]: name },
      body: bytes,
    });
    expect(res.status).toBe(201);
    return (await res.json()) as Attachment;
  }

  function startUpload(headers: Record<string, string>): {
    req: ClientRequest;
    answer: Promise<{ status: number; body: unknown }>;
  } {
    const req = request(`${base}/api/attachments`, { method: 'POST', headers });
    const answer = new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      req.on('error', reject);
      req.on('response', (res) => {
        let text = '';
        res.on('data', (chunk: Buffer) => (text += chunk.toString()));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
      });
    });
    return { req, answer };
  }

  it('uploads a video in parts and serves it whole, in ranges and to HEAD', async () => {
    const video = await upload(VIDEO, 'clip.mp4', 'video/mp4');
    expect(video).toMatchObject({ fileName: 'clip.mp4', size: VIDEO.byteLength });
    expect([...fake.objects.keys()]).toEqual([`attachments/${video.id}.mp4`]);
    expect(operations()).toContain('CompleteMultipartUpload');
    expect(fake.uploads.size).toBe(0);

    const whole = await fetch(`${base}${video.url}`);
    expect(whole.status).toBe(200);
    expect(Object.fromEntries(whole.headers)).toMatchObject({
      'accept-ranges': 'bytes',
      'content-length': String(VIDEO.byteLength),
      'content-type': 'video/mp4',
      'cache-control': 'private, max-age=31536000, immutable',
    });
    expect(Buffer.from(await whole.arrayBuffer()).equals(VIDEO)).toBe(true);

    const start = 5 * MB - 2;
    const part = await fetch(`${base}${video.url}`, { headers: { range: `bytes=${start}-` } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(
      `bytes ${start}-${VIDEO.byteLength - 1}/${VIDEO.byteLength}`,
    );
    expect(part.headers.get('content-length')).toBe(String(VIDEO.byteLength - start));
    expect(Buffer.from(await part.arrayBuffer()).equals(VIDEO.subarray(start))).toBe(true);
    expect(fake.calls.at(-1)).toMatchObject({
      operation: 'GetObject',
      range: `bytes=${start}-${VIDEO.byteLength - 1}`,
    });

    const head = await fetch(`${base}${video.url}`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe(String(VIDEO.byteLength));
    expect(operations().at(-1)).toBe('HeadObject');
  });

  it('deletes the object with the attachment', async () => {
    const file = await upload(Buffer.from('notes'), 'notes.txt', 'text/plain');
    expect(operations()).toEqual(['PutObject']);
    const res = await fetch(`${base}/api/attachments/${file.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(fake.objects.size).toBe(0);
    expect((await fetch(`${base}${file.url}`)).status).toBe(404);
  });

  it('answers 404 for a file missing from the bucket', async () => {
    const file = await upload(Buffer.from('notes'), 'notes.txt', 'text/plain');
    fake.objects.clear();
    for (const method of ['GET', 'HEAD']) {
      const res = await fetch(`${base}${file.url}`, { method });
      expect(res.status, method).toBe(404);
      expect(res.headers.get('content-type'), method).toContain('application/json');
    }
  });

  it('asks S3 for nothing until the request is signed in', async () => {
    const file = await upload(Buffer.from('notes'), 'notes.txt', 'text/plain');
    await addOwner(db);
    fake.calls.length = 0;
    for (const method of ['GET', 'HEAD']) {
      expect((await fetch(`${base}${file.url}`, { method })).status, method).toBe(401);
    }
    expect(fake.calls).toEqual([]);
  });

  // Images are read whole before they are stored (PT-127), so a too-big one never reaches S3.
  it('stops an image sent without a length at its limit, before it reaches S3', async () => {
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
    expect(fake.calls).toEqual([]);
    expect(await rowCount()).toBe(0);
  });

  it('keeps no object, parts or row when the client stops sending', async () => {
    const { req, answer } = startUpload({
      'content-type': 'video/mp4',
      'content-length': String(40 * MB),
      [FILE_NAME_HEADER]: 'clip.mp4',
    });
    answer.catch(() => undefined);
    req.write(VIDEO);
    await waitFor(() => operations().includes('UploadPart'), 'a part in S3');
    req.destroy();

    await waitFor(() => operations().includes('AbortMultipartUpload'), 'the upload to abort');
    expect(leftInS3()).toBe(0);
    // The pending row goes in before the file (PT-133) and out once the file has failed.
    let rows = await rowCount();
    for (let tries = 0; rows > 0 && tries < 100; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      rows = await rowCount();
    }
    expect(rows).toBe(0);
  });
});
