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
      '4. Verify the real changes yourself: read the diff and the changed files, run the tests and build, and try the feature where you can.',
      '5. Rate the work from 1 to 5:',
      '   - 5: fully meets the requirement, with good quality and tests',
      '   - 4: meets the requirement, with minor nits',
      '   - 3: works, but has notable issues',
      '   - 2: partially meets the requirement',
      '   - 1: does not meet the requirement',
      '6. Call review_ticket with the verdict, the rating and a short summary:',
      '   - "approved" only when the requirement is fully met and your verification passed.',
      '   - Otherwise "changes_requested", with specific, actionable feedback: what is wrong, where, and what to do. The ticket goes back to To do for a worker.',
      '',
      'Rules:',
      '- Never move a ticket to Done. Only a person does that, after your review.',
      '- When you are finished, give me a short list of the tickets you reviewed with their verdicts and ratings.',
    ].join('\n');
  },
};
