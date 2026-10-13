import { describe, expect, it } from 'vitest';
import { roleForCategory } from '../src/domain/run';
import type { PromptProject, PromptTicket } from '../src/logic/prompt';
import { buildReviewPrompt } from '../src/logic/reviewPrompt';

const NOW = new Date(2026, 9, 7, 12, 0);

const project: PromptProject = { name: 'Mobile app', key: 'MOB', repo: '~/code/mobile-app' };

const login: PromptTicket = {
  key: 'MOB-2',
  title: 'Show an error when the password is wrong',
  description: 'Inline error under the password field.',
  priority: 'high',
  statusName: 'Need review',
  due: '',
  assignee: 'Claude',
  notes: ['Keep the email filled in.'],
  lastReport: 'TICKET: MOB-2\nSTATUS: done\nSUMMARY: Added the error.',
  lastReview: null,
};

const reviewSteps = [
  '## How to review',
  "1. Call get_ticket for MOB-2 and read it in full: comments, attachments and the worker's report.",
  '2. Compare the work against the requirement in the title, description and comments, not just against the report. If there is an earlier review, check that its points were fixed.',
  '3. Verify the real changes yourself: read the diff and the changed files, run the tests and build, and try the feature where you can.',
  '4. Rate the work from 1 to 5:',
  '   - 5: fully meets the requirement, with good quality and tests',
  '   - 4: meets the requirement, with minor nits',
  '   - 3: works, but has notable issues',
  '   - 2: partially meets the requirement',
  '   - 1: does not meet the requirement',
  '5. Call review_ticket for MOB-2 with the verdict, the rating and a short summary:',
  '   - "approved" only when the requirement is fully met and your verification passed.',
  '   - Otherwise "changes_requested", with specific, actionable feedback: what is wrong, where, and what to do. The ticket goes back to To do for a worker.',
  '',
  'Rules:',
  "- Review only MOB-2. Don't fix the work yourself: say what to change in the review.",
  '- Never move a ticket to Done. Only a person does that, after your review.',
  '- When you finish, tell me the verdict and the rating.',
];

describe('buildReviewPrompt', () => {
  it('asks Claude to review one ticket, with the worker’s report, and record the review', () => {
    expect(buildReviewPrompt(project, login, NOW).split('\n')).toEqual([
      'Please review the work on ticket MOB-2 from my "Mobile app" project, using the tracker MCP tools.',
      'Repository / folder: ~/code/mobile-app',
      '',
      '## MOB-2: Show an error when the password is wrong',
      'Priority: High · Status: Need review · Assignee: Claude',
      '',
      'Inline error under the password field.',
      '',
      'Notes:',
      '- Keep the email filled in.',
      '',
      "The worker's report:",
      'TICKET: MOB-2',
      'STATUS: done',
      'SUMMARY: Added the error.',
      '',
      ...reviewSteps,
    ]);
  });

  it('adds the earlier review after the report, so the reviewer checks its points', () => {
    const lastReview = { verdict: 'changes_requested' as const, rating: 2, text: 'Add a test.' };
    const text = buildReviewPrompt(project, { ...login, lastReview }, NOW);

    expect(text).toContain(
      'SUMMARY: Added the error.\n\nEarlier review: Changes requested · 2/5\nAdd a test.\n\n## How to review',
    );
    expect(text).not.toContain('Last review:');
  });

  it('says when there is no report, and leaves out an empty repository', () => {
    const text = buildReviewPrompt({ ...project, repo: '' }, { ...login, lastReport: null }, NOW);

    expect(text).toContain("The worker's report:\n(No report yet.)");
    expect(text).not.toContain('Repository / folder');
    expect(text).not.toContain('Your last report');
  });

  it('never asks for the paste-back report block', () => {
    expect(buildReviewPrompt(project, login, NOW)).not.toContain('## When you finish');
  });
});

describe('roleForCategory', () => {
  it('reviews tickets in review and works on every other', () => {
    expect(roleForCategory('in_review')).toBe('review');
    for (const category of ['todo', 'in_progress', 'reviewed', 'done'] as const) {
      expect(roleForCategory(category)).toBe('work');
    }
  });
});
