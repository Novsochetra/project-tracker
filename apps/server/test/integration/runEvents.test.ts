import { randomUUID } from 'node:crypto';
import { HELPER_SILENCE_MS, type Run, type RunEvent, type RunRequest } from '@tracker/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Auth, type UserAuth } from '../helpers/runs';
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

  // B's own project, helper and run, so B's stream has something of its own to show.
  async function startOwnRun(user: UserAuth, runner: string): Promise<Run> {
    const [person, helper] = [
      caller(() => api.app, user.person),
      caller(() => api.app, user.helper),
    ];
    await person('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    await person('POST', '/api/projects/WEB/tickets', { title: 'Home' });
    await helper('PUT', `/api/runners/${runner}`, { name: 'B Mac', projectKeys: ['WEB'] });
    return (
      await person<Run>('POST', '/api/tickets/WEB-1/runs', { runnerId: runner, prompt: 'Go' })
    ).body;
  }

  it("reach only the run's own user, for every change a run goes through", async () => {
    clock.set(Date.now());
    const a = await addUser(api.db, 'a@example.com', clock.now());
    const b = await addUser(api.db, 'b@example.com', clock.now() + 1);
    const [aPerson, aHelper] = [caller(() => api.app, a.person), caller(() => api.app, a.helper)];
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

    const bRun = await startOwnRun(b, bRunner);

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

  it("tells only the run's own user that new steps came, named apart from run events", async () => {
    clock.set(Date.now());
    const a = await addUser(api.db, 'a@example.com', clock.now());
    const b = await addUser(api.db, 'b@example.com', clock.now() + 1);
    const [aPerson, aHelper] = [caller(() => api.app, a.person), caller(() => api.app, a.helper)];
    await aPerson('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await aPerson('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    const runner = randomUUID();
    await aHelper('PUT', `/api/runners/${runner}`, helperName('A Mac'));
    const run = (
      await aPerson<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' })
    ).body;
    await aHelper('POST', `/api/runners/${runner}/next`);
    const aStream = await stream(a.person);
    const bStream = await stream(b.person);
    const steps = [
      { kind: 'tool', label: 'Read a.ts' },
      { kind: 'text', label: 'Done.' },
    ];
    await aHelper('POST', `/api/runs/${run.id}/steps`, { runnerId: runner, steps });

    const aText = await readUntil(aStream, /^event: run-step\ndata: .+\n\n/m);
    const [, data = ''] = /^event: run-step\ndata: (.+)$/m.exec(aText) ?? [];
    expect(JSON.parse(data)).toEqual({
      type: 'run-step',
      runId: run.id,
      projectId: expect.any(String),
      ticketId: expect.any(String),
      chatId: null,
      count: 2,
    });
    expect(runEvents(aText)).toEqual([]);

    // Writes keep their order, so B's own run event arriving means A's steps never went to B.
    await startOwnRun(b, randomUUID());
    const bText = await readUntil(bStream, /^event: run\ndata: .+\n\n/m);
    expect(bText).not.toContain(run.id);
    expect(bText).not.toContain('run-step');
  });

  it("tells only the run's own user what Claude asks and how it ended", async () => {
    clock.set(Date.now());
    const a = await addUser(api.db, 'a@example.com', clock.now());
    const b = await addUser(api.db, 'b@example.com', clock.now() + 1);
    const [aPerson, aHelper] = [caller(() => api.app, a.person), caller(() => api.app, a.helper)];
    await aPerson('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await aPerson('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    const runner = randomUUID();
    await aHelper('PUT', `/api/runners/${runner}`, helperName('A Mac'));
    const run = (
      await aPerson<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' })
    ).body;
    await aHelper('POST', `/api/runners/${runner}/next`);
    const aStream = await stream(a.person);
    const bStream = await stream(b.person);
    const label = 'Run npm test';
    const request = (
      await aHelper<RunRequest>('POST', `/api/runs/${run.id}/requests`, {
        runnerId: runner,
        kind: 'permission',
        label,
        labelCut: false,
        questions: null,
      })
    ).body;
    await aPerson('POST', `/api/requests/${request.id}/answer`, { decision: 'allow' });

    const aText = await readUntil(aStream, /"status":"answered"/);
    const requestEvents = [...aText.matchAll(/^event: run-request\ndata: (.+)$/gm)].map(
      (match) => JSON.parse(match[1]!) as unknown,
    );
    const event = {
      type: 'run-request',
      runId: run.id,
      requestId: request.id,
      projectId: expect.any(String),
      ticketId: expect.any(String),
      chatId: null,
    };
    expect(requestEvents).toEqual([
      { ...event, status: 'open' },
      { ...event, status: 'answered' },
    ]);
    expect(aText).not.toContain(label);

    await startOwnRun(b, randomUUID());
    const bText = await readUntil(bStream, /^event: run\ndata: .+\n\n/m);
    expect(bText).not.toContain('run-request');
  });
});
