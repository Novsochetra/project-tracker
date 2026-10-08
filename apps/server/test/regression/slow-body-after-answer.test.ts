import { once } from 'node:events';
import type { Server } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { serve } from '@hono/node-server';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { endSlowRequests, isUploadRequest } from '../../src/http/slowRequests';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { createTestDatabase } from '../helpers/server';

const LIMIT_MS = 300;

let db: Db;
let server: Server;
let port: number;
const sockets: Socket[] = [];

beforeAll(async () => {
  db = await createTestDatabase('sqlite');
  const app = createApp({ db, storage: createMemoryStorage(), events: createBroadcaster() });
  server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
  endSlowRequests(server, LIMIT_MS, isUploadRequest);
  await once(server, 'listening');
  port = (server.address() as AddressInfo).port;
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.destroy();
});

afterAll(async () => {
  server.closeAllConnections();
  server.close();
  await db.destroy();
});

interface Connection {
  send: (text: string) => void;
  answers: () => number;
  received: () => string;
  closed: () => boolean;
}

async function openConnection(): Promise<Connection> {
  const socket = connect(port, '127.0.0.1');
  sockets.push(socket);
  await once(socket, 'connect');
  let received = '';
  let closed = false;
  socket.on('data', (chunk: Buffer) => (received += chunk.toString()));
  socket.on('close', () => (closed = true));
  socket.on('error', () => undefined);
  return {
    send: (text) => {
      if (!socket.destroyed) socket.write(text);
    },
    answers: () => received.split('HTTP/1.1 ').length - 1,
    received: () => received,
    closed: () => closed,
  };
}

async function waitFor(condition: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await sleep(10);
  }
  return true;
}

const head = (method: string, length: number | null) =>
  `${method} /api/projects HTTP/1.1\r\nHost: tracker.test\r\n` +
  (length === null ? '\r\n' : `Content-Length: ${length}\r\n\r\n`);

// The timer stopped when the answer was sent, and a GET or HEAD is answered without reading its
// body, so a client could hold the connection for the hour uploads get by sending a body slowly.
// Any byte that arrives turns off Node's keep-alive timeout, which would otherwise close it.
it.each(['GET', 'HEAD'])(
  'closes a %s answered before its body arrived once the limit passes',
  async (method) => {
    const started = Date.now();
    const connection = await openConnection();
    connection.send(`${head(method, 1000)}a`);
    const trickle = setInterval(() => connection.send('a'), 50);
    try {
      expect(await waitFor(() => connection.answers() === 1, LIMIT_MS)).toBe(true);
      expect(connection.received()).toMatch(/^HTTP\/1\.1 200/);

      expect(await waitFor(connection.closed, LIMIT_MS * 3)).toBe(true);
      expect(Date.now() - started).toBeGreaterThanOrEqual(LIMIT_MS - 20);
      expect(connection.answers()).toBe(1);
    } finally {
      clearInterval(trickle);
    }
  },
);

it('keeps the connection of a request whose body ends after its answer', async () => {
  const connection = await openConnection();
  connection.send(`${head('GET', 3)}a`);
  expect(await waitFor(() => connection.answers() === 1, LIMIT_MS)).toBe(true);
  connection.send('bc');
  await sleep(LIMIT_MS * 2);

  connection.send(head('GET', null));
  expect(await waitFor(() => connection.answers() === 2, LIMIT_MS)).toBe(true);
  expect(connection.received()).not.toContain('408');
  expect(connection.closed()).toBe(false);
});
