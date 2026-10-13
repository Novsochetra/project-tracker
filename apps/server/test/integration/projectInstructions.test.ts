import { randomUUID } from 'node:crypto';
import {
  PROJECT_INSTRUCTIONS_MAX,
  type ChatDetail,
  type Project,
  type ProjectDetail,
  type ProjectSummary,
  type PromptResult,
  type RunJob,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const INSTRUCTIONS = 'Write in a warm, plain voice.\nCheck every fact against two sources.';
const BLOCK = `## Project instructions\n${INSTRUCTIONS}`;

describe.each(DIALECTS)('project instructions (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const prompt = async (path: string) => (await person<PromptResult>('GET', path)).body.text;
  const askJob = async () => {
    await person<ChatDetail>('POST', '/api/projects/BLOG/chats', { runnerId: runner, text: 'Q' });
    return (await helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
  };

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
  });

  describe('with instructions', () => {
    beforeEach(async () => {
      const created = await person<ProjectDetail>('POST', '/api/projects', {
        name: 'Garden blog',
        key: 'BLOG',
        instructions: `  ${INSTRUCTIONS}\n`,
      });
      expect(created.body.project.instructions).toBe(INSTRUCTIONS);
      await person('POST', '/api/projects/BLOG/tickets', { title: 'Spring bulbs' });
      await helper('PUT', `/api/runners/${runner}`, { name: 'Mac', projectKeys: ['BLOG'] });
    });

    it('keeps them on the project and in the list', async () => {
      const detail = await person<ProjectDetail>('GET', '/api/projects/BLOG');
      expect(detail.body.project.instructions).toBe(INSTRUCTIONS);
      const list = await person<ProjectSummary[]>('GET', '/api/projects');
      expect(list.body[0]?.instructions).toBe(INSTRUCTIONS);
    });

    it('puts them in the ticket and project prompts', async () => {
      expect(await prompt('/api/tickets/BLOG-1/prompt')).toContain(BLOCK);
      expect(await prompt('/api/projects/BLOG/prompt')).toContain(BLOCK);
    });

    it('puts them in what a chat question sends', async () => {
      expect((await askJob())?.prompt).toContain(BLOCK);
    });

    it('takes an edit and leaves the prompts as today once cleared', async () => {
      const edited = await person<Project>('PATCH', '/api/projects/BLOG', {
        instructions: 'Short.',
      });
      expect(edited.body.instructions).toBe('Short.');
      expect(await prompt('/api/tickets/BLOG-1/prompt')).toContain(
        '## Project instructions\nShort.',
      );

      await person('PATCH', '/api/projects/BLOG', { instructions: '' });
      expect(await prompt('/api/tickets/BLOG-1/prompt')).not.toContain('Project instructions');
      expect((await askJob())?.prompt).not.toContain('Project instructions');
    });
  });

  it('starts a project without instructions and leaves them out of the prompts', async () => {
    const created = await person<ProjectDetail>('POST', '/api/projects', {
      name: 'Blog',
      key: 'BLOG',
    });
    expect(created.body.project.instructions).toBe('');
    await person('POST', '/api/projects/BLOG/tickets', { title: 'Spring bulbs' });
    expect(await prompt('/api/tickets/BLOG-1/prompt')).not.toContain('Project instructions');
    expect(await prompt('/api/projects/BLOG/prompt')).not.toContain('Project instructions');
  });

  it('refuses instructions over the limit', async () => {
    const tooLong = 'x'.repeat(PROJECT_INSTRUCTIONS_MAX + 1);
    const create = await person('POST', '/api/projects', { name: 'Blog', instructions: tooLong });
    expect(create.status).toBe(400);
    await person('POST', '/api/projects', { name: 'Blog', key: 'BLOG' });
    const edit = await person('PATCH', '/api/projects/BLOG', { instructions: tooLong });
    expect(edit.status).toBe(400);
  });
});
