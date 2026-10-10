import { once } from 'node:events';
import { realpathSync } from 'node:fs';
import { createServer, connect, type AddressInfo, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { TrackerClient } from '@tracker/client';
import type { RunStatus } from '@tracker/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { createDatabase } from '../../src/db/createDatabase';
import { migrateToLatest } from '../../src/db/migrator';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { runClaude } from '../../../agent/src/watch/claude';
import { followRunEvents } from '../../../agent/src/watch/liveStream';
import { createWatcher } from '../../../agent/src/watch/watcher';
import { installFakeClaude } from '../../../agent/test/watch/fakeClaude';

const portOf = (server: { address(): unknown }) => (server.address() as AddressInfo).port;

async function cuttableLink(targetPort: number) {
  const sockets = new Set<Socket>();
  const link = createServer((inbound) => {
    const outbound = connect(targetPort, '127.0.0.1');
    for (const socket of [inbound, outbound]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => undefined);
    }
    inbound.pipe(outbound).pipe(inbound);
  });
  link.listen(0, '127.0.0.1');
  await once(link, 'listening');
  return {
    url: `http://127.0.0.1:${portOf(link)}`,
    cut: () => sockets.forEach((socket) => socket.destroy()),
    close: () => link.close(),
  };
}

describe('tracker watch against a real tracker', () => {
  const fake = installFakeClaude();
  const stop = new AbortController();
  const runnerId = randomUUID();
  const logs: string[] = [];
  let close: () => Promise<void> = () => Promise.resolve();
  let person: TrackerClient;
  let link: Awaited<ReturnType<typeof cuttableLink>>;

  const statusOf = async (runId: string): Promise<RunStatus> => (await person.getRun(runId)).status;
  const start = async (ticketKey: string, prompt: string) =>
    (await person.startRun(ticketKey, { runnerId, prompt })).id;

  beforeAll(async () => {
    const db = createDatabase(':memory:');
    await migrateToLatest(db);
    const app = createApp({ db, storage: createMemoryStorage(), events: createBroadcaster() });
    const server = serve({
      fetch: app.fetch,
      port: 0,
      hostname: '127.0.0.1',
      overrideGlobalObjects: false,
    });
    await once(server, 'listening');
    person = new TrackerClient({ baseUrl: `http://127.0.0.1:${portOf(server)}` });
    link = await cuttableLink(portOf(server));
    await person.createProject({ name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login', 'Offline', 'Slow']) {
      await person.createTicket('MOB', { title });
    }
    const helper = new TrackerClient({
      baseUrl: link.url,
      actor: { kind: 'agent', name: 'Claude' },
    });
    const settings = { runnerId, name: 'Test Mac', projectKey: 'MOB' };
    await helper.registerRunner(runnerId, { name: settings.name, projectKeys: ['MOB'] });
    const cwd = realpathSync(tmpdir());
    const watcher = createWatcher(
      {
        api: helper,
        log: (text) => logs.push(text),
        runClaude: (prompt, signal) =>
          runClaude({ command: fake.command, cwd }, prompt, signal, () => undefined),
      },
      settings,
    );
    const stream = followRunEvents({
      url: link.url,
      token: undefined,
      signal: stop.signal,
      onOpen: () => void watcher.lookForWork(),
      onRun: watcher.onRunEvent,
      onDrop: () => undefined,
    });
    close = async () => {
      stop.abort();
      await Promise.all([watcher.stop(), stream]);
      link.close();
      server.close();
      await db.destroy();
      fake.remove();
    };
  });

  afterAll(() => close());

  it('runs a run the person starts and reports it done', async () => {
    const runId = await start('MOB-1', 'Fix MOB-1');
    await vi.waitFor(async () => expect(await statusOf(runId)).toBe('done'), { timeout: 10_000 });
    expect(logs).toContain('MOB-1: Claude Code finished.');
  });

  it('reports a failing Claude with what it printed', async () => {
    const runId = await start('MOB-2', 'FAIL on MOB-2');
    await vi.waitFor(async () => expect(await statusOf(runId)).toBe('failed'), { timeout: 10_000 });
    expect((await person.getRun(runId)).error).toContain('boom');
  });

  it('still runs a run queued while the connection was down', async () => {
    link.cut();
    const runId = await start('MOB-3', 'Fix MOB-3');
    await vi.waitFor(async () => expect(await statusOf(runId)).toBe('done'), { timeout: 15_000 });
  });

  it('stops Claude when the person cancels', async () => {
    const runId = await start('MOB-4', 'WAIT on MOB-4');
    await vi.waitFor(async () => expect(await statusOf(runId)).toBe('running'), {
      timeout: 10_000,
    });
    await person.cancelRun(runId);
    await vi.waitFor(() => expect(logs).toContain('MOB-4: Cancelled.'), { timeout: 10_000 });
    expect(await statusOf(runId)).toBe('cancelled');
  });
});
