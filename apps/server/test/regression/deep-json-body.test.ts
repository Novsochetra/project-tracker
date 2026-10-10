import { describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/server';

// Dropping NULs walked the body by recursion, so a field the schema doesn't know, nested 200,000
// levels deep (400 KB, under the 1 MB limit), overflowed the stack and answered 500. Before that it
// was ignored like any unknown field.
describe('a JSON body with a deeply nested field the schema does not know', () => {
  const api = useTestServer('sqlite');

  it('is answered as if the field were not there', async () => {
    const depth = 200_000;
    const junk = `${'['.repeat(depth)}"\\u0000"${']'.repeat(depth)}`;
    const response = await api.app.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: `{"name":"Deep\\u0000","key":"DP","junk":${junk}}`,
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ project: { name: 'Deep', key: 'DP' } });
  });
});
