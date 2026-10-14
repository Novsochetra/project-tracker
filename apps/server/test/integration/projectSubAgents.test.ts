import { randomUUID } from 'node:crypto';
import {
  DEFAULT_MAX_SUB_AGENTS,
  type Project,
  type ProjectDetail,
  type PromptResult,
  type RunJob,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const RULE = 'Use at most 3 sub agents at once.';

describe.each(DIALECTS)('max sub agents per ticket (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const prompt = async () =>
    (await person<PromptResult>('GET', '/api/tickets/MOB-1/prompt')).body.text;
  const edit = (maxSubAgents: unknown) =>
    person<Project>('PATCH', '/api/projects/MOB', { maxSubAgents });

  beforeEach(async () => {
    const mine = await addUser(api.db, 'a@example.com', Date.now());
    person = caller(() => api.app, mine.person);
    helper = caller(() => api.app, mine.helper);
    const created = await person<ProjectDetail>('POST', '/api/projects', {
      name: 'Mobile',
      key: 'MOB',
    });
    expect(created.body.project.maxSubAgents).toBe(DEFAULT_MAX_SUB_AGENTS);
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName(runner));
  });

  it('starts a project at 3 and puts the rules in the ticket prompt', async () => {
    const text = await prompt();
    expect(text).toContain('## Sub agents');
    expect(text).toContain(RULE);
    expect(text).toContain('Two sub agents never change the same file.');
  });

  it('keeps an edit and leaves the rules out at 1', async () => {
    expect((await edit(5)).body.maxSubAgents).toBe(5);
    expect(await prompt()).toContain('Use at most 5 sub agents at once.');
    expect((await edit(1)).body.maxSubAgents).toBe(1);
    const detail = await person<ProjectDetail>('GET', '/api/projects/MOB');
    expect(detail.body.project.maxSubAgents).toBe(1);
    expect(await prompt()).not.toContain('sub agent');
  });

  it.each([0, 6, 2.5])('refuses %j', async (maxSubAgents) => {
    expect((await edit(maxSubAgents)).status).toBe(400);
  });

  it('sends the rules to the helper with a ticket run', async () => {
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: await prompt() });
    const job = await helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ticket`);
    expect(job.body?.prompt).toContain(RULE);
  });

  it('leaves them out of a Run all batch', async () => {
    await person('POST', '/api/projects/MOB/run-all', { runnerId: runner });
    const take = `/api/runners/${runner}/next?kind=ticket&batches=1`;
    const job = (await helper<RunJob | null>('POST', take)).body;
    expect(job?.run.kind).toBe('batch');
    expect(job?.prompt).not.toContain('## Sub agents');
  });
});
