import { randomUUID } from 'node:crypto';
import {
  RUN_REQUEST_DEADLINE_MS,
  type Chat,
  type ChatDetail,
  type Run,
  type RunJob,
  type RunRequest,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('a chat waiting for the person (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let chatId: string;
  let run: Run;

  const waiting = async () => {
    const list = (await person<Chat[]>('GET', '/api/projects/MOB/chats')).body;
    const detail = (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body;
    return [list.map((chat) => chat.waiting), detail.chat.waiting];
  };
  const asks = async () =>
    (
      await helper<RunRequest>('POST', `/api/runs/${run.id}/requests`, {
        runnerId: runner,
        kind: 'permission',
        label: 'Run npm test',
        labelCut: false,
        questions: null,
      })
    ).body;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Rename the queue',
      mode: 'edit',
    });
    chatId = started.body.chat.id;
    const job = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`);
    run = job.body.run;
  });

  it('says so while Claude asks, and no longer once the person answers', async () => {
    expect(await waiting()).toEqual([[false], false]);
    const request = await asks();
    expect(await waiting()).toEqual([[true], true]);
    await person('POST', `/api/requests/${request.id}/answer`, { decision: 'allow' });
    expect(await waiting()).toEqual([[false], false]);
  });

  it('no longer says so past the deadline', async () => {
    await asks();
    clock.advance(RUN_REQUEST_DEADLINE_MS - 1);
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    expect(await waiting()).toEqual([[true], true]);
    clock.advance(1);
    expect(await waiting()).toEqual([[false], false]);
  });

  it('no longer says so once the run ended', async () => {
    await asks();
    await helper('POST', `/api/runs/${run.id}/finish`, { status: 'failed', error: 'Stopped' });
    expect(await waiting()).toEqual([[false], false]);
  });
});
