import { Agent, createServer, get, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeServer, stopOnSignals, trackLiveStreams } from '../../src/shutdown';

interface Running {
  server: Server;
  liveStreams: Set<Socket>;
  port: number;
}

let running: Running | undefined;

async function start(): Promise<Running> {
  const server = createServer((req, res) => {
    if (req.url === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(': connected\n\n');
    } else if (req.url === '/slow') {
      setTimeout(() => res.end('done'), 300);
    } else if (req.url !== '/stuck') {
      res.end('ok');
    }
  });
  const liveStreams = trackLiveStreams(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  running = { server, liveStreams, port: (server.address() as AddressInfo).port };
  return running;
}

afterEach(() => {
  running?.server.closeAllConnections();
  running?.server.close();
  running = undefined;
});

const keepAlive = new Agent({ keepAlive: true });

function open(port: number, path: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) =>
    get({ host: '127.0.0.1', port, path, agent: keepAlive }, resolve).on('error', reject),
  );
}

const bodyOf = (res: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let text = '';
    res.on('data', (chunk: Buffer) => (text += chunk.toString()));
    res.on('end', () => resolve(text));
    res.on('error', reject);
  });

const ended = (res: IncomingMessage): Promise<void> =>
  new Promise((resolve) => res.socket.once('close', () => resolve()));

describe('stopping the server', () => {
  it('lets a request under way finish, ends live streams at once, then stops', async () => {
    const { server, liveStreams, port } = await start();
    const stream = await open(port, '/api/events');
    const streamEnded = ended(stream);
    const slow = open(port, '/slow');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const started = Date.now();
    const closing = closeServer(server, liveStreams, 5_000);
    await streamEnded;
    expect(Date.now() - started).toBeLessThan(150);
    expect(await bodyOf(await slow)).toBe('done');
    await closing;
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(server.listening).toBe(false);
  });

  it('takes no new connection once it is stopping', async () => {
    const { server, liveStreams, port } = await start();
    const slow = open(port, '/slow');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const closing = closeServer(server, liveStreams, 5_000);
    await expect(open(port, '/other')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    await bodyOf(await slow);
    await closing;
  });

  it('cuts a request still under way when the grace period ends', async () => {
    const { server, liveStreams, port } = await start();
    const stuck = new Promise<string>((resolve) =>
      get({ host: '127.0.0.1', port, path: '/stuck', agent: keepAlive }).on('error', (error) =>
        resolve((error as NodeJS.ErrnoException).code ?? ''),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    const started = Date.now();
    await closeServer(server, liveStreams, 200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(190);
    expect(await stuck).toBe('ECONNRESET');
  });

  it('closes the database after the server on SIGTERM, then exits', async () => {
    const { server } = await start();
    const order: string[] = [];
    server.on('close', () => order.push('server'));
    const exited = new Promise<number | undefined>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((code) => {
        resolve(code as number | undefined);
        return undefined as never;
      });
    });
    const before = { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM') };
    const db = { destroy: () => Promise.resolve(void order.push('database')) };
    stopOnSignals(server, db, 1_000);
    try {
      process.emit('SIGTERM');
      expect(await exited).toBe(0);
      expect(order).toEqual(['server', 'database']);
    } finally {
      vi.restoreAllMocks();
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        for (const listener of process.listeners(signal)) {
          if (!before[signal].includes(listener)) process.off(signal, listener);
        }
      }
    }
  });
});
