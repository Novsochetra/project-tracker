import type { ProjectDetail, Status } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { DIALECTS, useTestServer } from '../helpers/server';

// An empty PATCH body produced `update statuses set where …`, which is invalid SQL (500).
describe.each(DIALECTS)('empty status patch (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('returns the status unchanged without touching the project', async () => {
    const project = (await api.post<ProjectDetail>('/api/projects', { name: 'Mobile app' })).body;
    const status = project.statuses[0]!;
    api.events.length = 0;

    const res = await api.patch<Status>(`/api/statuses/${status.id}`, {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual(status);
    expect((await api.get<ProjectDetail>('/api/projects/MA')).body.project.updatedAt).toBe(
      project.project.updatedAt,
    );
    expect(api.events).toEqual([]);
  });
});
