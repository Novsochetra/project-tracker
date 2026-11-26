import { PROJECT_ORDER_MAX, type ErrorBody, type ProjectSummary } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { PROJECTS_CHANGED } from '../../src/services/projectOrder';
import { invitePerson, ownerCookie, sender } from '../helpers/accounts';
import { agent } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('PUT /api/projects/order (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const keys = (list: readonly ProjectSummary[]) => list.map((project) => project.key);
  const listed = async () => keys(await api.client().listProjects());

  async function makeProjects(...names: string[]): Promise<string[]> {
    const ids = [];
    for (const name of names) ids.push((await api.client().createProject({ name })).project.id);
    api.events.length = 0;
    return ids;
  }

  it('lists projects in creation order until someone reorders them', async () => {
    await makeProjects('Alpha', 'Beta', 'Gamma');
    expect(await listed()).toEqual(['ALP', 'BET', 'GAM']);
  });

  it('keeps the order sent, answers with the list in it and tells other screens', async () => {
    const [alpha, beta, gamma] = await makeProjects('Alpha', 'Beta', 'Gamma');
    const res = await api.put<ProjectSummary[]>('/api/projects/order', {
      ids: [gamma, alpha, beta],
    });
    expect(res.status).toBe(200);
    expect(keys(res.body)).toEqual(['GAM', 'ALP', 'BET']);
    expect(res.body[0]).toMatchObject({ name: 'Gamma', openCount: 0 });
    expect(await listed()).toEqual(['GAM', 'ALP', 'BET']);
    expect(api.events).toEqual([{ type: 'changed', projectId: gamma, ticketId: null }]);
  });

  it('puts a new project last, after a reorder too', async () => {
    const [alpha, beta] = await makeProjects('Alpha', 'Beta');
    await api.client().reorderProjects([beta ?? '', alpha ?? '']);
    await api.client().createProject({ name: 'Gamma' });
    expect(await listed()).toEqual(['BET', 'ALP', 'GAM']);
  });

  it("doesn't count as activity on the projects", async () => {
    const [alpha, beta] = await makeProjects('Alpha', 'Beta');
    const before = await api.client().listProjects();
    const after = await api.client().reorderProjects([beta ?? '', alpha ?? '']);
    const activity = (list: readonly ProjectSummary[]) =>
      Object.fromEntries(list.map((project) => [project.key, project.lastActivityAt]));
    expect(activity(after)).toEqual(activity(before));
  });

  it('refuses a list that misses, repeats or adds a project, and keeps the order', async () => {
    const [alpha, beta, gamma] = await makeProjects('Alpha', 'Beta', 'Gamma');
    for (const ids of [
      [gamma, alpha],
      [gamma, alpha, alpha],
      [gamma, alpha, beta, 'p-unknown'],
    ]) {
      const res = await api.put<ErrorBody>('/api/projects/order', { ids });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(PROJECTS_CHANGED);
    }
    expect((await api.put('/api/projects/order', { ids: [] })).status).toBe(400);
    expect((await api.put('/api/projects/order', {})).status).toBe(400);
    expect(await listed()).toEqual(['ALP', 'BET', 'GAM']);
    expect(api.events).toEqual([]);
  });

  it('refuses a list longer than the cap before reading any project', async () => {
    await makeProjects('Alpha');
    const ids = Array.from({ length: PROJECT_ORDER_MAX + 1 }, (_, index) => `p-${index}`);
    expect(PROJECT_ORDER_MAX).toBe(1_000);
    const res = await api.put<ErrorBody>('/api/projects/order', { ids });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
    expect(await listed()).toEqual(['ALP']);
    expect(api.events).toEqual([]);
  });

  it('ends in one of two reorders sent at once, never a mix of them', async () => {
    const [alpha, beta, gamma] = await makeProjects('Alpha', 'Beta', 'Gamma');
    const first = [gamma ?? '', beta ?? '', alpha ?? ''];
    const second = [beta ?? '', alpha ?? '', gamma ?? ''];
    await api.client().reorderProjects([alpha ?? '', gamma ?? '', beta ?? '']);
    await Promise.all([api.client().reorderProjects(first), api.client().reorderProjects(second)]);
    expect([
      ['GAM', 'BET', 'ALP'],
      ['BET', 'ALP', 'GAM'],
    ]).toContainEqual(await listed());
  });

  it('is for a person only', async () => {
    const [alpha, beta] = await makeProjects('Alpha', 'Beta');
    const refused = await api.put<ErrorBody>(
      '/api/projects/order',
      { ids: [beta, alpha] },
      { actor: agent() },
    );
    expect(refused.status).toBe(403);
    expect(refused.body.error.message).toBe('Only a person reorders projects.');
    expect(await listed()).toEqual(['ALP', 'BET']);
  });

  it("orders only the user's own projects and can't name someone else's", async () => {
    const send = sender(() => api.app);
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const made = async (cookie: string, name: string) =>
      (
        (await (await send('POST', '/api/projects', cookie, { name })).json()) as {
          project: { id: string };
        }
      ).project.id;
    const ownerA = await made(owner, 'Alpha');
    const ownerB = await made(owner, 'Beta');
    const theirs = await made(person.cookie, 'Gamma');
    const mixed = await send('PUT', '/api/projects/order', owner, {
      ids: [ownerB, theirs, ownerA],
    });
    expect(mixed.status).toBe(409);
    const own = await send('PUT', '/api/projects/order', owner, { ids: [ownerB, ownerA] });
    expect(keys((await own.json()) as ProjectSummary[])).toEqual(['BET', 'ALP']);
    const theirList = (await (
      await send('GET', '/api/projects', person.cookie)
    ).json()) as ProjectSummary[];
    expect(keys(theirList)).toEqual(['GAM']);
  });
});
