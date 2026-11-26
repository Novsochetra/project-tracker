import type { Project, ProjectDetail, ProjectSummary, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, type Caller } from '../helpers/callers';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('hide a project name (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let agent: Caller;

  const hide = (hideName: unknown) => person<Project>('PATCH', '/api/projects/MOB', { hideName });

  beforeEach(async () => {
    const mine = await addUser(api.db, 'a@example.com', Date.now());
    person = caller(() => api.app, mine.person);
    agent = caller(() => api.app, mine.agent);
    const created = await person<ProjectDetail>('POST', '/api/projects', {
      name: 'Secret launch',
      key: 'MOB',
    });
    expect(created.body.project.hideName).toBe(false);
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
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
    const refused = await agent('PATCH', '/api/projects/MOB', { hideName: false });
    expect(refused.status).toBe(403);
    const detail = await person<ProjectDetail>('GET', '/api/projects/MOB');
    expect(detail.body.project.hideName).toBe(true);
  });

  it('gives an agent the real name', async () => {
    await hide(true);
    const detail = await agent<TicketDetail>('GET', '/api/tickets/MOB-1');
    expect(detail.body.project).toMatchObject({ name: 'Secret launch', hideName: true });
  });
});
