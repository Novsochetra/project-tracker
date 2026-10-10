import { randomUUID } from 'node:crypto';
import { HELPER_SILENCE_MS, type Run, type RunEvent } from '@tracker/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
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
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
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

  it("reach only the run's own user, for every change a run goes through", async () => {
    clock.set(Date.now());
    const a = await addUser(api.db, 'a@example.com', clock.now());
    const b = await addUser(api.db, 'b@example.com', clock.now() + 1);
    const [aPerson, aHelper] = [caller(() => api.app, a.person), caller(() => api.app, a.helper)];
    const [bPerson, bHelper] = [caller(() => api.app, b.person), caller(() => api.app, b.helper)];
    await aPerson('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await aPerson('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await aPerson('POST', '/api/projects/MOB/tickets', { title: 'Login' });
    const aStream = await stream(a.helper);
    const bStream = await stream(b.person);
    const [aRunner, bRunner] = [randomUUID(), randomUUID()];
    const checkIn = () => aHelper('PUT', `/api/runners/${aRunner}`, helperName('A Mac'));
    const start = async () =>
      (await aPerson<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: aRunner, prompt: 'Go' }))
        .body;

    await checkIn();
    const done = await start();
    await aHelper('POST', `/api/runners/${aRunner}/next`);
    await aHelper('POST', `/api/runs/${done.id}/finish`, { status: 'done' });
    const cancelled = await start();
    await aPerson('POST', `/api/runs/${cancelled.id}/cancel`);
    const expired = await start();
    clock.advance(HELPER_SILENCE_MS);
    await aPerson('GET', `/api/runs/${expired.id}`);
    await checkIn();
    const removed = await start();
    await aPerson('DELETE', `/api/runners/${aRunner}`);

    await bHelper('PUT', `/api/runners/${bRunner}`, helperName('B Mac'));
    const bRun = (
      await bPerson<Run>('POST', '/api/tickets/MOB-2/runs', { runnerId: bRunner, prompt: 'Go' })
    ).body;

    // Writes keep their order, so B's own event arriving first means none of A's were sent to B.
    const bText = await readUntil(bStream, /^event: run\ndata: .+\n\n/m);
    expect(runEvents(bText)).toEqual([
      expect.objectContaining({ runId: bRun.id, runnerId: bRunner, status: 'queued' }),
    ]);
    const aText = await readUntil(aStream, new RegExp(`"runId":"${removed.id}","[^}]+"failed"`));
    const seen = runEvents(aText).map(({ runId, status }) => [runId, status]);
    expect(seen).toEqual([
      [done.id, 'queued'],
      [done.id, 'running'],
      [done.id, 'done'],
      [cancelled.id, 'queued'],
      [cancelled.id, 'cancelled'],
      [expired.id, 'queued'],
      [expired.id, 'failed'],
      [removed.id, 'queued'],
      [removed.id, 'failed'],
    ]);
    expect(aText).not.toContain(bRun.id);
    expect(aText).not.toContain('userId');
  });
});
