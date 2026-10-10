import { once } from 'node:events';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RunEvent } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { followRunEvents } from '../../src/watch/liveStream';

const RUN: RunEvent = {
  type: 'run',
  runId: 'r-1',
  runnerId: 'x',
  projectId: 'p',
  ticketId: 't',
  status: 'queued',
};

async function sseServer() {
  const open: ServerResponse[] = [];
  const headers: (string | undefined)[] = [];
  const server = createServer((request, response) => {
    headers.push(request.headers.authorization);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write(': connected\n\n');
    open.push(response);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    headers,
    send: (text: string) => open.at(-1)!.write(text),
    dropAll: () => open.splice(0).forEach((response) => response.socket?.destroy()),
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}

describe('followRunEvents', () => {
  let stop = new AbortController();
  let close = () => undefined as void;

  afterEach(() => {
    stop.abort();
    stop = new AbortController();
    close();
  });

  it('hands on run events, sends the token, and reconnects after a drop', async () => {
    const server = await sseServer();
    close = server.close;
    const onOpen = vi.fn();
    const onRun = vi.fn();
    void followRunEvents({
      url: server.url,
      token: 'trk_secret',
      signal: stop.signal,
      onOpen,
      onRun,
      onDrop: () => undefined,
    });
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    server.send(`event: ping\ndata: \n\nevent: run\ndata: ${JSON.stringify(RUN)}\n\n`);
    await vi.waitFor(() => expect(onRun).toHaveBeenCalledWith(RUN));
    expect(server.headers).toEqual(['Bearer trk_secret']);

    server.dropAll();
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledTimes(2), { timeout: 5_000 });
  });

  it('reconnects a stream that goes silent, as a proxy can keep a dead one open', async () => {
    const server = await sseServer();
    close = server.close;
    const onOpen = vi.fn();
    void followRunEvents({
      url: server.url,
      token: undefined,
      signal: stop.signal,
      onOpen,
      onRun: () => undefined,
      onDrop: () => undefined,
      staleMs: 100,
    });
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledTimes(2), { timeout: 5_000 });
    expect(server.headers[0]).toBeUndefined();
  });
});
