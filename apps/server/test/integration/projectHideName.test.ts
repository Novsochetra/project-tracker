import { randomUUID } from 'node:crypto';
import type {
  Project,
  ProjectDetail,
  ProjectSummary,
  PromptResult,
  Run,
  RunActivity,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('hide a project name (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const hide = (hideName: unknown) => person<Project>('PATCH', '/api/projects/MOB', { hideName });

  beforeEach(async () => {
    const mine = await addUser(api.db, 'a@example.com', Date.now());
    person = caller(() => api.app, mine.person);
    helper = caller(() => api.app, mine.helper);
    const created = await person<ProjectDetail>('POST', '/api/projects', {
      name: 'Secret launch',
      key: 'MOB',
    });
    expect(created.body.project.hideName).toBe(false);
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, { ...helperName('A Mac'), projectKeys: ['MOB'] });
  });

  it('keeps the switch and the real name, and turns it off again', async () => {
    expect((await hide(true)).body).toMatchObject({ hideName: true, name: 'Secret launch' });
    const list = (await person<ProjectSummary[]>('GET', '/api/projects')).body;
    expect(list.map(({ name, hideName }) => [name, hideName])).toEqual([['Secret launch', true]]);
    expect((await hide(false)).body.hideName).toBe(false);
  });

  it('refuses a switch that is not true or false', async () => {
    expect((await hide('yes')).status).toBe(400);
  });

  it('refuses an agent turning it off', async () => {
    await hide(true);
    const refused = await helper('PATCH', '/api/projects/MOB', { hideName: false });
    expect(refused.status).toBe(403);
    const detail = await person<ProjectDetail>('GET', '/api/projects/MOB');
    expect(detail.body.project.hideName).toBe(true);
  });

  it('gives Claude the real name and the Activity screen the stand-in', async () => {
    await hide(true);
    const prompt = await person<PromptResult>('GET', '/api/tickets/MOB-1/prompt');
    expect(prompt.body.text).toContain('"Secret launch"');
    await person<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Do it' });
    const activity = (await person<RunActivity>('GET', '/api/run-activity')).body;
    expect(activity.runs.map((run) => run.projectName)).toEqual(['Project MOB']);
  });
});
