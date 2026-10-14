import { describe, expect, it } from 'vitest';
import {
  ASK_PERSON_LINE,
  buildBatchPrompt,
  buildTicketPrompt,
  type PromptProject,
  type PromptTicket,
} from '../src/logic/prompt';

const NOW = new Date(2026, 9, 7, 12, 0);

const project: PromptProject = { name: 'Mobile app', key: 'MOB', repo: '~/code/mobile-app' };

const ticket: PromptTicket = {
  key: 'MOB-4',
  title: 'Dark mode colors for Settings',
  description: 'Every screen of Settings.',
  priority: 'medium',
  statusName: 'To do',
  due: '',
  assignee: '',
  notes: [],
  lastReport: null,
  lastReview: null,
};

const promptWith = (maxSubAgents: number) =>
  buildTicketPrompt({ ...project, maxSubAgents }, ticket, NOW);

const rules = (most: number) =>
  [
    'Every screen of Settings.',
    '',
    '## Sub agents',
    '- You may use sub agents (the Agent tool) when parts of this ticket can be done at the same time.',
    `- Use at most ${most} sub agents at once.`,
    '- For a small ticket, work alone.',
    '- Give each sub agent its own files. Two sub agents never change the same file.',
    '- When all sub agents end, check the full result yourself and run the tests before you report.',
    '',
    ASK_PERSON_LINE,
  ].join('\n');

describe('buildTicketPrompt with sub agents', () => {
  it('keeps the prompt of a project without sub agents exactly as it was', () => {
    expect(promptWith(1)).toBe(buildTicketPrompt(project, ticket, NOW));
    expect(promptWith(1)).not.toContain('sub agent');
  });

  it('lets Claude use up to 3 sub agents, each with its own files', () => {
    expect(promptWith(3)).toContain(rules(3));
  });

  it('names the most at once', () => {
    expect(promptWith(5)).toContain(rules(5));
    expect(promptWith(5)).not.toContain('at most 3');
  });

  it('leaves a batch prompt as it was', () => {
    const tickets = [{ key: 'MOB-4', title: 'Dark mode', priority: 'medium' as const }];
    expect(buildBatchPrompt({ ...project, maxSubAgents: 5 }, tickets, 2)).toBe(
      buildBatchPrompt(project, tickets, 2),
    );
  });
});
