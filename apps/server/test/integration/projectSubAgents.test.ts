import { randomUUID } from 'node:crypto';
import { type Project, type PromptResult, type RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('sub agents in a ticket run (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const prompt = async () =>
    (await person<PromptResult>('GET', '/api/tickets/MOB-1/prompt')).body.text;

  beforeEach(async () => {
    const mine = await addUser(api.db, 'a@example.com', Date.now());
    person = caller(() => api.app, mine.person);
    helper = caller(() => api.app, mine.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName(runner));
  });

  it('lets Claude decide in the ticket prompt, with no number', async () => {
    const text = await prompt();
    expect(text).toContain('## Sub agents');
    expect(text).toContain("follow the repo's CLAUDE.md");
    expect(text).toContain('Two sub agents never change the same file.');
    expect(text).not.toMatch(/at most \d/);
  });

  it('accepts the old fields from an older client and ignores them', async () => {
    const edit = await person<Project>('PATCH', '/api/projects/MOB', { maxSubAgents: 1 });
    expect(edit.status).toBe(200);
    expect(edit.body).not.toHaveProperty('maxSubAgents');
    expect(await prompt()).toContain('## Sub agents');
  });

  it('sends the rules to the helper with a ticket run', async () => {
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: await prompt() });
    const job = await helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ticket`);
    expect(job.body?.prompt).toContain('## Sub agents');
  });

  it('leaves them out of a Run all batch', async () => {
    await person('POST', '/api/projects/MOB/run-all', { runnerId: runner });
    const take = `/api/runners/${runner}/next?kind=ticket&batches=1`;
    const job = (await helper<RunJob | null>('POST', take)).body;
    expect(job?.run.kind).toBe('batch');
    expect(job?.prompt).not.toContain('## Sub agents');
  });
});
