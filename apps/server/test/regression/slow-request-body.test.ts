import { once } from 'node:events';
import { createServer, request, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { endSlowRequests, isUploadRequest } from '../../src/http/slowRequests';

const LIMIT_MS = 200;

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const delay = req.url === '/api/slow-answer' ? LIMIT_MS * 2 : 0;
      setTimeout(() => res.end('ok'), delay);
    });
  });
  endSlowRequests(server, LIMIT_MS, isUploadRequest);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

interface Sent {
  status: number;
  ms: number;
}

// Sends the first byte of a three-byte body, waits, then the other two.
function sendSlowly(method: string, path: string, pauseMs: number): Promise<Sent> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port,
      method,
      path,
      headers: { 'content-length': '3' },
    });
    req.on('response', (res: IncomingMessage) => {
      res.resume();
      resolve({ status: res.statusCode ?? 0, ms: Date.now() - started });
    });
    req.on('error', reject);
    req.write('a');
    setTimeout(() => {
      if (!req.destroyed) req.end('bc');
    }, pauseMs);
  });
}

// main.ts gives a request an hour to arrive so a large video can, which let any request take an
// hour to send its body. Only uploads get the hour now; the rest keep Node's five minutes.
it('answers 408 to a request that is not an upload when its body is still arriving', async () => {
  const sent = await sendSlowly('POST', '/api/projects', LIMIT_MS * 3);
  expect(sent.status).toBe(408);
  expect(sent.ms).toBeGreaterThanOrEqual(LIMIT_MS - 20);
  expect(sent.ms).toBeLessThan(LIMIT_MS * 3);
});

it('lets an upload keep sending past that time', async () => {
  const sent = await sendSlowly('POST', '/api/attachments?ticketKey=MOB-1', LIMIT_MS * 2);
  expect(sent.status).toBe(200);
});

it('leaves a request whose body has arrived alone while it is answered', async () => {
  const sent = await sendSlowly('POST', '/api/slow-answer', 0);
  expect(sent.status).toBe(200);
  expect(sent.ms).toBeGreaterThanOrEqual(LIMIT_MS * 2 - 20);
});

it('knows an upload by its method and path', () => {
  const message = (method: string, url: string) => ({ method, url }) as IncomingMessage;
  expect(isUploadRequest(message('POST', '/api/attachments'))).toBe(true);
  expect(isUploadRequest(message('POST', '/api/attachments?ticketKey=MOB-1'))).toBe(true);
  expect(isUploadRequest(message('DELETE', '/api/attachments/a1'))).toBe(false);
  expect(isUploadRequest(message('POST', '/api/projects'))).toBe(false);
});
