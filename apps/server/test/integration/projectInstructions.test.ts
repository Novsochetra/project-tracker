import {
  PROJECT_INSTRUCTIONS_MAX,
  type Project,
  type ProjectDetail,
  type ProjectSummary,
  type TicketDetail,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, type Caller } from '../helpers/callers';
import { DIALECTS, useTestServer } from '../helpers/server';

const INSTRUCTIONS = 'Write in a warm, plain voice.\nCheck every fact against two sources.';

describe.each(DIALECTS)('project instructions (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  let person: Caller;
  let agent: Caller;

  const ticketInstructions = async () =>
    (await agent<TicketDetail>('GET', '/api/tickets/BLOG-1')).body.project.instructions;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    agent = caller(() => api.app, owner.agent);
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
    });

    it('keeps them on the project and in the list', async () => {
      const detail = await person<ProjectDetail>('GET', '/api/projects/BLOG');
      expect(detail.body.project.instructions).toBe(INSTRUCTIONS);
      const list = await person<ProjectSummary[]>('GET', '/api/projects');
      expect(list.body[0]?.instructions).toBe(INSTRUCTIONS);
    });

    it('gives them to an agent with each ticket it reads', async () => {
      expect(await ticketInstructions()).toBe(INSTRUCTIONS);
    });

    it('takes an edit, and clears them with an empty one', async () => {
      const edited = await person<Project>('PATCH', '/api/projects/BLOG', {
        instructions: 'Short.',
      });
      expect(edited.body.instructions).toBe('Short.');
      expect(await ticketInstructions()).toBe('Short.');

      await person('PATCH', '/api/projects/BLOG', { instructions: '' });
      expect(await ticketInstructions()).toBe('');
    });
  });

  it('starts a project without instructions', async () => {
    const created = await person<ProjectDetail>('POST', '/api/projects', {
      name: 'Blog',
      key: 'BLOG',
    });
    expect(created.body.project.instructions).toBe('');
    await person('POST', '/api/projects/BLOG/tickets', { title: 'Spring bulbs' });
    expect(await ticketInstructions()).toBe('');
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
