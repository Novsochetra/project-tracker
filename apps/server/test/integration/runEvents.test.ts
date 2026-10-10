import { randomUUID } from 'node:crypto';
import type { Run, RunEvent } from '@tracker/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Auth } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

type Reader = ReadableStreamDefaultReader<Uint8Array>;

async function readUntil(reader: Reader, pattern: RegExp): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  while (!pattern.test(text)) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`Stream ended before ${String(pattern)}: ${text}`);
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
}

const runEvents = (text: string): RunEvent[] =>
  [...text.matchAll(/^event: run\ndata: (.+)$/gm)].map(
    (match) => JSON.parse(match[1]!) as RunEvent,
  );

describe.each(DIALECTS)('run events (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const readers: Reader[] = [];

  afterEach(async () => {
    await Promise.all(readers.splice(0).map((reader) => reader.cancel()));
  });

  async function stream(auth: Auth): Promise<Reader> {
    const headers: Record<string, string> = auth.token
      ? { authorization: `Bearer ${auth.token}` }
      : { cookie: auth.cookie ?? '' };
    const response = await api.app.request('/api/events', { headers });
    const reader = response.body!.getReader();
    readers.push(reader);
    await readUntil(reader, /: connected\n\n/);
    return reader;
  }

  async function startOn(auth: Auth, helper: Auth, ticket: string): Promise<Run> {
    const runner = randomUUID();
    await caller(() => api.app, helper)('PUT', `/api/runners/${runner}`, helperName('Mac'));
    const started = await caller(() => api.app, auth)<Run>('POST', `/api/tickets/${ticket}/runs`, {
      runnerId: runner,
      prompt: `Work on ${ticket}`,
    });
    expect(started.status).toBe(201);
    return started.body;
  }

  it("reach only the run's own user, and only as named run events", async () => {
    const a = await addUser(api.db, 'a@example.com', Date.now());
    const b = await addUser(api.db, 'b@example.com', Date.now() + 1);
    const person = caller(() => api.app, a.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Login' });
    const aStream = await stream(a.helper);
    const bStream = await stream(b.person);

    const aRun = await startOn(a.person, a.helper, 'MOB-1');
    const bRun = await startOn(b.person, b.helper, 'MOB-2');

    // Writes keep their order, so B's own event arriving first means A's was never sent to B.
    const bText = await readUntil(bStream, /^event: run\ndata: .+\n\n/m);
    expect(runEvents(bText)).toEqual([
      expect.objectContaining({ type: 'run', runId: bRun.id, status: 'queued' }),
    ]);
    expect(bText).not.toContain(aRun.id);
    const aText = await readUntil(aStream, /^event: run\ndata: .+\n\n/m);
    expect(runEvents(aText)).toEqual([
      {
        type: 'run',
        runId: aRun.id,
        runnerId: aRun.runnerId,
        projectId: expect.any(String),
        ticketId: expect.any(String),
        status: 'queued',
      },
    ]);
    expect(aText).not.toContain('userId');
  });
});
