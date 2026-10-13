import { describe, expect, it } from 'vitest';
import { PROJECT_INSTRUCTIONS_MAX } from '../src/domain/project';
import { createProjectInput, updateProjectInput } from '../src/api/schemas';
import { buildAskPrompt } from '../src/logic/askPrompt';
import { instructionsBlock } from '../src/logic/instructions';
import {
  buildProjectPrompt,
  buildTicketPrompt,
  type PromptProject,
  type PromptTicket,
} from '../src/logic/prompt';

const NOW = new Date(2026, 9, 7, 12, 0);
const INSTRUCTIONS = 'Write in a warm, plain voice.\nCheck every fact against two sources.';

const project: PromptProject = { name: 'Garden blog', key: 'BLOG', repo: '' };
const instructed: PromptProject = { ...project, instructions: `  ${INSTRUCTIONS}\n\n` };

const ticket: PromptTicket = {
  key: 'BLOG-2',
  title: 'Post about spring bulbs',
  description: '',
  priority: 'medium',
  statusName: 'To do',
  due: '',
  assignee: '',
  notes: [],
  lastReport: null,
  lastReview: null,
};

const ask = (instructions?: string) =>
  buildAskPrompt({
    project: { key: 'BLOG', name: 'Garden blog', instructions },
    mode: 'ask',
    question: 'What should I write next?',
    history: [{ role: 'person', text: 'Hi' }],
  });

describe('instructionsBlock', () => {
  it('gives a heading and the trimmed text', () => {
    expect(instructionsBlock(instructed, '##')).toEqual(['## Project instructions', INSTRUCTIONS]);
  });

  it('gives nothing for missing, empty or blank instructions', () => {
    expect(instructionsBlock(project, '##')).toEqual([]);
    expect(instructionsBlock({ instructions: '' }, '##')).toEqual([]);
    expect(instructionsBlock({ instructions: ' \n\t ' }, '##')).toEqual([]);
  });
});

describe('buildTicketPrompt with instructions', () => {
  it('puts the instructions after the opening line, before the ticket', () => {
    const lines = buildTicketPrompt(instructed, ticket, NOW).split('\n');
    expect(lines.slice(0, 6)).toEqual([
      'Please work on ticket BLOG-2 from my "Garden blog" project.',
      '',
      '## Project instructions',
      'Write in a warm, plain voice.',
      'Check every fact against two sources.',
      '',
    ]);
    expect(lines[6]).toBe('## BLOG-2: Post about spring bulbs');
  });

  it('comes after the repository line', () => {
    const prompt = buildTicketPrompt({ ...instructed, repo: '~/blog' }, ticket, NOW);
    expect(prompt.indexOf('Repository / folder: ~/blog')).toBeLessThan(
      prompt.indexOf('## Project instructions'),
    );
  });

  it('is today’s prompt without instructions', () => {
    const blank = { ...project, instructions: '  ' };
    expect(buildTicketPrompt(blank, ticket, NOW)).toBe(buildTicketPrompt(project, ticket, NOW));
    expect(buildTicketPrompt(project, ticket, NOW)).not.toContain('Project instructions');
  });
});

describe('buildProjectPrompt with instructions', () => {
  it('puts the instructions before the first ticket', () => {
    const prompt = buildProjectPrompt(instructed, [ticket], NOW);
    expect(prompt).toContain(`\n\n## Project instructions\n${INSTRUCTIONS}\n\n---\n\n### BLOG-2`);
  });

  it('is today’s prompt without instructions', () => {
    const blank = { ...project, instructions: '' };
    expect(buildProjectPrompt(blank, [ticket], NOW)).toBe(
      buildProjectPrompt(project, [ticket], NOW),
    );
    expect(buildProjectPrompt(project, [ticket], NOW)).not.toContain('Project instructions');
  });
});

describe('buildAskPrompt with instructions', () => {
  it('puts the instructions after the rules, before the chat so far', () => {
    const prompt = ask(INSTRUCTIONS);
    expect(prompt).toContain(`---\n\n## Project instructions\n${INSTRUCTIONS}\n\n---\n\n`);
    expect(prompt.indexOf('Project instructions')).toBeLessThan(prompt.indexOf('Earlier'));
  });

  it('is today’s prompt without instructions', () => {
    expect(ask('')).toBe(ask(undefined));
    expect(ask(undefined)).not.toContain('Project instructions');
  });
});

describe('project instructions in the API schemas', () => {
  it('takes instructions up to the limit, trimmed', () => {
    const text = 'x'.repeat(PROJECT_INSTRUCTIONS_MAX);
    expect(createProjectInput.parse({ name: 'Blog', instructions: ` ${text} ` }).instructions).toBe(
      text,
    );
    expect(updateProjectInput.parse({ instructions: text }).instructions).toBe(text);
  });

  it('refuses instructions over the limit', () => {
    const text = 'x'.repeat(PROJECT_INSTRUCTIONS_MAX + 1);
    expect(createProjectInput.safeParse({ name: 'Blog', instructions: text }).success).toBe(false);
    expect(updateProjectInput.safeParse({ instructions: text }).success).toBe(false);
  });

  it('says the limit from the constant', () => {
    const text = 'x'.repeat(PROJECT_INSTRUCTIONS_MAX + 1);
    expect(updateProjectInput.safeParse({ instructions: text }).error?.issues[0]?.message).toBe(
      'Instructions can be up to 20,000 characters.',
    );
  });
});
