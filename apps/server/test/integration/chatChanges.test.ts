import { randomUUID } from 'node:crypto';
import {
  GH_NOT_SET_UP,
  GIT_ACTION_LOST,
  PROTECTED_BRANCH,
  type ChatChangesAnswer,
  type ChatDetail,
  type GitActionJob,
  type RunJob,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { HELPER_OFFLINE } from '../../src/services/chatChanges/queueGitAction';
import { GIT_ACTION_NOT_TAKEN } from '../../src/services/chatChanges/expireGitAction';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const DIFF = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n';
const TREE = 'a'.repeat(40);
const FILES = [
  { path: 'a.ts', dirtyBefore: false },
  { path: 'notes.md', dirtyBefore: true },
];

describe.each(DIALECTS)("a chat's changes (%s)", (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let other: Caller;
  let chatId: string;

  const changesBody = (body: object = {}) => ({
    runnerId: runner,
    tree: TREE,
    diff: DIFF,
    cut: false,
    files: FILES,
    branch: 'chat/fix',
    defaultBranch: 'main',
    ghReady: true,
    ...body,
  });
  const takeTurn = async (body: object = {}) => {
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`)).body;
    const sent = await helper('POST', `/api/runs/${job.run.id}/chat-changes`, changesBody(body));
    await helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer: 'Done.' });
    return { job, sent };
  };
  const askAgain = (body: object = {}) => {
    clock.advance(1000);
    return person('POST', `/api/chats/${chatId}/messages`, {
      runnerId: runner,
      text: 'More',
      ...body,
    });
  };
  const read = (as = person) => as<ChatChangesAnswer>('GET', `/api/chats/${chatId}/changes`);
  const version = async () => (await read()).body.changes?.version ?? '';
  const commit = async (body: object = {}, as = person) =>
    as<ChatChangesAnswer>('POST', `/api/chats/${chatId}/changes/commit`, {
      version: await version(),
      message: 'Fix the login',
      paths: ['a.ts'],
      ...body,
    });
  const pullRequest = async (body: object = {}) =>
    person<ChatChangesAnswer>('POST', `/api/chats/${chatId}/changes/pull-request`, {
      version: await version(),
      title: 'Fix the login',
      confirm: true,
      ...body,
    });
  const takeAction = () =>
    helper<GitActionJob | null>('POST', `/api/runners/${runner}/git-actions/next`);
  const finishAction = (id: string, body: object) =>
    helper('POST', `/api/git-actions/${id}/finish`, { runnerId: runner, ...body });

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    const someone = await addUser(api.db, 'someone@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    other = caller(() => api.app, someone.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Fix the login',
      mode: 'edit',
    });
    chatId = started.body.chat.id;
  });

  it("keeps an Edit turn's changes for the chat, and hands its files to the next turn", async () => {
    expect((await read()).body).toEqual({ changes: null, action: null });
    const { job, sent } = await takeTurn();
    expect(job.chatFiles).toEqual([]);
    expect(sent.status).toBe(204);
    expect((await read()).body).toEqual({
      changes: {
        version: job.run.id,
        diff: DIFF,
        cut: false,
        files: FILES,
        branch: 'chat/fix',
        defaultBranch: 'main',
        ghReady: true,
        createdAt: clock.now(),
      },
      action: null,
    });
    expect((await read(other)).status).toBe(404);
    await askAgain();
    const next = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`);
    expect(next.body.chatFiles).toEqual(FILES);
  });

  it('takes changes only for a running Edit or Auto question of the helper that took it', async () => {
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`)).body;
    const stranger = { ...changesBody(), runnerId: randomUUID() };
    expect((await helper('POST', `/api/runs/${job.run.id}/chat-changes`, stranger)).status).toBe(
      403,
    );
    await helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer: 'Ok.' });
    expect(
      (await helper('POST', `/api/runs/${job.run.id}/chat-changes`, changesBody())).status,
    ).toBe(409);
    await askAgain({ mode: 'ask' });
    const ask = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    expect(ask.chatFiles).toBeUndefined();
    expect(
      (await helper('POST', `/api/runs/${ask.run.id}/chat-changes`, changesBody())).status,
    ).toBe(409);
  });

  it("commits only the chat's files, for a person, on the changes they saw", async () => {
    await takeTurn();
    expect((await commit({}, helper)).status).toBe(403);
    expect((await commit({ version: 'old' })).body).toMatchObject({
      error: { message: 'Claude changed more since you looked. Look at the changes again.' },
    });
    expect((await commit({ paths: ['../../etc/passwd'] })).status).toBe(400);
    expect((await commit({ branch: 'main' })).status).toBe(400);
    expect((await commit({ branch: '--force' })).status).toBe(400);
    const queued = await commit({ branch: 'chat/new' });
    expect(queued.body.action).toMatchObject({ kind: 'commit', status: 'queued', error: null });
    expect((await commit()).status).toBe(409);
    const job = (await takeAction()).body;
    expect(job).toEqual({
      id: queued.body.action?.id,
      chatId,
      kind: 'commit',
      message: 'Fix the login',
      paths: ['a.ts'],
      branch: 'chat/new',
      tree: TREE,
      keep: [FILES[1]],
    });
  });

  it('keeps what is left after a commit as the new changes', async () => {
    await takeTurn();
    const id = (await commit()).body.action?.id ?? '';
    await takeAction();
    const left = changesBody({ diff: '', files: [FILES[1]] });
    const { runnerId: _r, ...changes } = left;
    const result = { sha: 'abc1234', branch: 'chat/fix' };
    expect((await finishAction(id, { status: 'done', result, changes })).status).toBe(204);
    expect((await finishAction(id, { status: 'done' })).status).toBe(409);
    const read2 = (await read()).body;
    expect(read2.changes).toMatchObject({ version: id, files: [FILES[1]] });
    expect(read2.action).toMatchObject({ status: 'done', result });
  });

  it('opens a pull request only with gh set up, after the confirm step, off the main branch', async () => {
    await takeTurn({ ghReady: false });
    expect((await pullRequest()).body).toMatchObject({ error: { message: GH_NOT_SET_UP } });
    await askAgain();
    await takeTurn({ branch: 'main' });
    expect((await pullRequest()).body).toMatchObject({ error: { message: PROTECTED_BRANCH } });
    await askAgain();
    await takeTurn();
    expect((await pullRequest({ confirm: false })).status).toBe(400);
    const queued = await pullRequest();
    expect(queued.body.action).toMatchObject({ kind: 'pull_request', status: 'queued' });
    expect((await takeAction()).body).toMatchObject({
      kind: 'pull_request',
      title: 'Fix the login',
    });
  });

  it('fails one never taken, or lost by a helper gone silent, when the phone looks', async () => {
    await takeTurn();
    await commit();
    clock.advance(11 * 60_000);
    expect((await read()).body.action).toMatchObject({
      status: 'failed',
      error: GIT_ACTION_NOT_TAKEN,
    });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    await commit();
    await takeAction();
    clock.advance(2 * 60_000);
    expect((await read()).body.action).toMatchObject({ status: 'failed', error: GIT_ACTION_LOST });
  });

  it('refuses a commit for a computer that is offline', async () => {
    await takeTurn();
    clock.advance(2 * 60_000);
    expect((await commit()).body).toMatchObject({ error: { message: HELPER_OFFLINE } });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    expect((await commit()).status).toBe(200);
  });

  it('fails an action the helper lost in a restart, and one it never took in time', async () => {
    await takeTurn();
    await commit();
    await takeAction();
    expect((await takeAction()).body).toBeNull();
    expect((await read()).body.action).toMatchObject({ status: 'failed', error: GIT_ACTION_LOST });
    await commit();
    clock.set(clock.now() + 11 * 60_000);
    expect((await takeAction()).body).toBeNull();
    expect((await read()).body.action).toMatchObject({ status: 'failed' });
  });

  it('refuses a commit while Claude still works in the chat', async () => {
    await takeTurn();
    await askAgain();
    expect((await commit()).body).toMatchObject({
      error: { message: 'Wait until Claude finishes in this chat.' },
    });
  });
});
