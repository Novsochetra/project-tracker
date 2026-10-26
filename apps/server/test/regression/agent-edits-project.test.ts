import type { ErrorBody, Project, ProjectDetail } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { addUser, caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-246: the PT-227 review read a branch made before PT-209, where an agent token could change a
// project's name or delete the project.
describe.each(DIALECTS)('regression: an agent edits or deletes a project (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('answers 403 to an agent token and lets the person edit and delete', async () => {
    const user = await addUser(api.db, 'owner@example.com', Date.now());
    const person = caller(() => api.app, user.person);
    const helper = caller(() => api.app, user.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    const name = async () =>
      (await person<ProjectDetail>('GET', '/api/projects/MOB')).body.project.name;
    const before = await name();

    const edit = await helper<ErrorBody>('PATCH', '/api/projects/MOB', { name: 'Renamed' });
    expect(edit.status).toBe(403);
    expect((await helper<ErrorBody>('DELETE', '/api/projects/MOB')).status).toBe(403);
    expect(await name()).toBe(before);

    const own = await person<Project>('PATCH', '/api/projects/MOB', { name: 'Renamed' });
    expect(own.body.name).toBe('Renamed');
    expect((await person('DELETE', '/api/projects/MOB')).status).toBe(204);
  });
});
