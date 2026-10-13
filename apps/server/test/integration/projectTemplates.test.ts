import {
  DEFAULT_STATUSES,
  PROJECT_TEMPLATE_NAMES,
  PROJECT_TEMPLATES,
  type ErrorBody,
  type ProjectDetail,
  type PromptResult,
} from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { agent, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

const shape = ({ project, statuses }: ProjectDetail) => ({
  instructions: project.instructions,
  statuses: statuses.map(({ name, category, color, position }) => ({
    name,
    category,
    color,
    position,
  })),
});

describe.each(DIALECTS)('project templates (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it.each(PROJECT_TEMPLATE_NAMES)(
    'creates a %s project with its statuses and instructions',
    async (template) => {
      const created = await api.post<ProjectDetail>('/api/projects', { name: 'Work', template });
      expect(created.status).toBe(201);
      const { statuses, instructions } = PROJECT_TEMPLATES[template];
      expect(shape(created.body)).toEqual({
        instructions,
        statuses: statuses.map((status, position) => ({ ...status, position })),
      });
      expect(shape(await api.client().getProject(created.body.project.key))).toEqual(
        shape(created.body),
      );
    },
  );

  it('creates a project without a template exactly as before templates', async () => {
    const plain = await api.client().createProject({ name: 'App', key: 'APP' });
    const software = await api.client().createProject({
      name: 'App two',
      key: 'APPB',
      template: 'software',
    });
    const before = {
      instructions: '',
      statuses: DEFAULT_STATUSES.map((status, position) => ({ ...status, position })),
    };
    expect(shape(plain)).toEqual(before);
    expect(shape(software)).toEqual(before);
  });

  it('keeps instructions sent with the template, also empty ones', async () => {
    const client = api.client();
    const typed = await client.createProject({
      name: 'Blog',
      template: 'writing',
      instructions: 'Short posts.',
    });
    expect(typed.project.instructions).toBe('Short posts.');
    const cleared = await client.createProject({
      name: 'Notes',
      template: 'writing',
      instructions: '',
    });
    expect(cleared.project.instructions).toBe('');
    expect(cleared.statuses[0]?.name).toBe('Ideas');
  });

  it('refuses a template it does not know', async () => {
    const res = await api.post<ErrorBody>('/api/projects', { name: 'Food', template: 'cooking' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
  });

  it('runs a Writing ticket with the writing instructions and the usual workflow', async () => {
    const blog = await api.client().createProject({
      name: 'Garden blog',
      key: 'BLOG',
      template: 'writing',
    });
    await api.client().createTicket('BLOG', { title: 'Spring bulbs' });

    const prompt = await api.get<PromptResult>('/api/tickets/BLOG-1/prompt');
    expect(prompt.body.text).toContain(
      `## Project instructions\n${PROJECT_TEMPLATES.writing.instructions}`,
    );

    const worker = api.client(agent('Worker'));
    expect((await worker.claimNext('BLOG'))?.status.name).toBe('Drafting');
    const submitted = await worker.submitForReview('BLOG-1', { summary: 'Draft attached.' });
    expect(submitted.status.name).toBe('Needs edit');
    const reviewed = await api.client(agent('Reviewer')).reviewTicket('BLOG-1', {
      verdict: 'approved',
      rating: 5,
      summary: 'Reads well.',
    });
    expect(reviewed.status.name).toBe('Edited');
    const publish = api
      .client(agent('Worker'))
      .moveTicket('BLOG-1', { statusId: statusOf(blog, 'done').id });
    await expect(publish).rejects.toMatchObject({ status: 403 });
  });
});
