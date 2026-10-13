import { REVIEW_RATING_SCALE, REVIEW_VERDICT_RULES } from '@tracker/shared';
import {
  findProjectStep,
  normalizeProject,
  projectArgument,
  type PromptDefinition,
} from './prompt';

export const reviewPrompt: PromptDefinition = {
  name: 'review',
  title: 'Review tracker tickets',
  description:
    'Reviewer loop: verify the work on tickets in Need review, rate it 1-5 and approve or request changes.',
  text(rawProject) {
    const project = normalizeProject(rawProject);
    return [
      'Review finished work in my project tracker, using the tracker MCP tools.',
      findProjectStep(project),
      '',
      `1. Call list_tickets with ${projectArgument(project)} and category "in_review" to find tickets waiting for review. If there are none, tell me and stop.`,
      "2. Take them one at a time. Call get_ticket and read the title, description, comments, attachments and the worker's report.",
      '3. Compare the work against the requirement in the title, description and comments, not just against the report.',
      "4. Verify the real result yourself. When the work is code, read the diff and the changed files, run the tests and build, and try the feature where you can. Otherwise check the result against the ticket and the project's instructions.",
      '5. Rate the work from 1 to 5:',
      ...REVIEW_RATING_SCALE,
      '6. Call review_ticket with the verdict, the rating and a short summary:',
      ...REVIEW_VERDICT_RULES,
      '',
      'Rules:',
      '- Never move a ticket to Done. Only a person does that, after your review.',
      '- When you are finished, give me a short list of the tickets you reviewed with their verdicts and ratings.',
    ].join('\n');
  },
};
