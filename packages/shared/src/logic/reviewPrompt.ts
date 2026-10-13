import { VERDICT_LABELS } from '../domain/activity';
import {
  instructionLines,
  repoLine,
  ticketBlock,
  type PromptProject,
  type PromptTicket,
} from './prompt';

// Shared with the MCP review prompt (apps/agent/src/prompts/review.ts), so the two can't drift.
export const REVIEW_RATING_SCALE = [
  '   - 5: fully meets the requirement, with good quality and tests',
  '   - 4: meets the requirement, with minor nits',
  '   - 3: works, but has notable issues',
  '   - 2: partially meets the requirement',
  '   - 1: does not meet the requirement',
];

export const REVIEW_VERDICT_RULES = [
  '   - "approved" only when the requirement is fully met and your verification passed.',
  '   - Otherwise "changes_requested", with specific, actionable feedback: what is wrong, where, and what to do. The ticket goes back to To do for a worker.',
];

function workToReview({ lastReport, lastReview }: PromptTicket): string[] {
  const out = ['', "The worker's report:", lastReport ?? '(No report yet.)'];
  if (lastReview) {
    const { verdict, rating, text } = lastReview;
    out.push('', `Earlier review: ${VERDICT_LABELS[verdict]} · ${rating}/5`, text);
  }
  return out;
}

function reviewSteps(key: string): string[] {
  return [
    '## How to review',
    `1. Call get_ticket for ${key} and read it in full: comments, attachments and the worker's report.`,
    '2. Compare the work against the requirement in the title, description and comments, not just against the report. If there is an earlier review, check that its points were fixed.',
    "3. Verify the real result yourself. When the work is code, read the diff and the changed files, run the tests and build, and try the feature where you can. Otherwise check the result against the ticket and the project's instructions.",
    '4. Rate the work from 1 to 5:',
    ...REVIEW_RATING_SCALE,
    `5. Call review_ticket for ${key} with the verdict, the rating and a short summary:`,
    ...REVIEW_VERDICT_RULES,
  ];
}

export function buildReviewPrompt(
  project: PromptProject,
  ticket: PromptTicket,
  now: Date = new Date(),
): string {
  const { key } = ticket;
  return [
    `Please review the work on ticket ${key} from my "${project.name}" project, using the tracker MCP tools.`,
    ...repoLine(project),
    ...instructionLines(project),
    '',
    ticketBlock({ ...ticket, lastReport: null, lastReview: null }, '##', now),
    ...workToReview(ticket),
    '',
    ...reviewSteps(key),
    '',
    'Rules:',
    `- Review only ${key}. Don't fix the work yourself: say what to change in the review.`,
    '- Never move a ticket to Done. Only a person does that, after your review.',
    '- When you finish, tell me the verdict and the rating.',
  ].join('\n');
}
