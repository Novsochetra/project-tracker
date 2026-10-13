import { describe, expect, it } from 'vitest';
import { createProjectInput } from '../src/api/schemas';
import { PROJECT_INSTRUCTIONS_MAX } from '../src/domain/project';
import {
  PROJECT_TEMPLATE_NAMES,
  PROJECT_TEMPLATES,
  type ProjectTemplateName,
} from '../src/domain/projectTemplates';
import { DEFAULT_STATUSES, STATUS_CATEGORIES } from '../src/domain/status';
import { buildTicketPrompt, type PromptTicket } from '../src/logic/prompt';

const NAMES: Record<ProjectTemplateName, string[]> = {
  software: ['To do', 'In progress', 'Need review', 'Reviewed', 'Done'],
  writing: ['Ideas', 'Drafting', 'Needs edit', 'Edited', 'Published'],
  research: ['Questions', 'Researching', 'Needs check', 'Checked', 'Answered'],
  operations: ['To do', 'Doing', 'Needs check', 'Checked', 'Done'],
  personal: ['To do', 'Doing', 'Check', 'Ready', 'Done'],
};

const WORK_TEMPLATES = PROJECT_TEMPLATE_NAMES.filter((name) => name !== 'software');

const ticket: PromptTicket = {
  key: 'BLOG-1',
  title: 'Post about spring bulbs',
  description: '',
  priority: 'medium',
  statusName: 'Ideas',
  due: '',
  assignee: '',
  notes: [],
  lastReport: null,
  lastReview: null,
};

describe('project templates', () => {
  it('lists Software first', () => {
    expect(PROJECT_TEMPLATE_NAMES[0]).toBe('software');
    expect(PROJECT_TEMPLATE_NAMES.map((name) => PROJECT_TEMPLATES[name].label)).toEqual([
      'Software',
      'Writing',
      'Research',
      'Operations',
      'Personal',
    ]);
  });

  it('keeps Software as today: the default statuses and no instructions', () => {
    expect(PROJECT_TEMPLATES.software.statuses).toBe(DEFAULT_STATUSES);
    expect(PROJECT_TEMPLATES.software.instructions).toBe('');
  });

  it.each(PROJECT_TEMPLATE_NAMES)('gives %s its statuses, one per category in order', (name) => {
    const { statuses } = PROJECT_TEMPLATES[name];
    expect(statuses.map((status) => status.name)).toEqual(NAMES[name]);
    expect(statuses.map((status) => status.category)).toEqual([...STATUS_CATEGORIES]);
    expect(statuses.map((status) => status.color)).toEqual(DEFAULT_STATUSES.map((s) => s.color));
  });

  it.each(WORK_TEMPLATES)(
    'says what done and verified mean for %s, and where results go',
    (name) => {
      const { instructions } = PROJECT_TEMPLATES[name];
      expect(instructions).toMatch(/^This project is .+, not code/);
      expect(instructions).toContain('- Done: ');
      expect(instructions).toContain('- Verified: ');
      expect(instructions).toContain('attach_file');
      expect(instructions).toContain('OUTPUT');
      expect(instructions).toBe(instructions.trim());
      expect(instructions.length).toBeLessThan(PROJECT_INSTRUCTIONS_MAX);
    },
  );

  it('puts the writing instructions into a ticket prompt', () => {
    const project = {
      name: 'Garden blog',
      key: 'BLOG',
      repo: '',
      instructions: PROJECT_TEMPLATES.writing.instructions,
    };
    const prompt = buildTicketPrompt(project, ticket);
    expect(prompt).toContain(`## Project instructions\n${PROJECT_TEMPLATES.writing.instructions}`);
    expect(prompt).toContain('There are no tests or builds.');
  });
});

describe('the template in createProjectInput', () => {
  it('defaults to software', () => {
    expect(createProjectInput.parse({ name: 'App' }).template).toBe('software');
  });

  it.each(PROJECT_TEMPLATE_NAMES)('takes %s', (template) => {
    expect(createProjectInput.parse({ name: 'App', template }).template).toBe(template);
  });

  it('refuses a template it does not know', () => {
    expect(createProjectInput.safeParse({ name: 'App', template: 'cooking' }).success).toBe(false);
  });
});
