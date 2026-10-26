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

const tickets = [{ key: 'MOB-4', title: 'Dark mode', priority: 'medium' as const }];

describe('buildTicketPrompt with sub agents', () => {
  it('lets Claude decide, with no fixed number', () => {
    const prompt = buildTicketPrompt(project, ticket, NOW);
    expect(prompt).toContain(
      [
        '## Sub agents',
        '- You may use sub agents (the Agent tool) when parts of this ticket can be done at the same time.',
        "- Decide how many to use, and follow the repo's CLAUDE.md for any limit.",
        '- For a small ticket, work alone.',
        '- Give each sub agent its own files. Two sub agents never change the same file.',
        '- When all sub agents end, check the full result yourself and run the tests before you report.',
        '',
        ASK_PERSON_LINE,
      ].join('\n'),
    );
    expect(prompt).not.toMatch(/at most \d/);
  });
});

describe('buildBatchPrompt sub agent limit', () => {
  it('keeps "at most N at once" when the picker has a number', () => {
    const prompt = buildBatchPrompt(project, tickets, 2);
    expect(prompt).toContain('- Run at most 2 sub agents at once.');
    expect(prompt).not.toContain('Decide how many');
  });

  it("lets Claude decide and follow the repo's CLAUDE.md when the picker has none", () => {
    const prompt = buildBatchPrompt(project, tickets, null);
    expect(prompt).toContain(
      "- Decide how many sub agents to run at once, and follow the repo's CLAUDE.md for any limit.",
    );
    expect(prompt).not.toMatch(/at most \d/);
    expect(buildBatchPrompt(project, tickets)).toBe(prompt);
  });
});
