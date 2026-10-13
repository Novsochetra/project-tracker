import {
  findProjectStep,
  normalizeProject,
  projectArgument,
  type PromptDefinition,
} from './prompt';

export const workPrompt: PromptDefinition = {
  name: 'work',
  title: 'Work on tracker tickets',
  description:
    'Worker loop: claim the next To do ticket, do the work in this repository, verify it and submit it for review.',
  text(rawProject) {
    const project = normalizeProject(rawProject);
    return [
      'Work on a ticket from my project tracker, using the tracker MCP tools.',
      findProjectStep(project),
      '',
      `1. Call claim_next_ticket with ${projectArgument(project)}. It moves the highest-priority To do ticket to In progress and returns it in full. If nothing is waiting, tell me and stop.`,
      '2. Read the ticket fully: title, description, attachments, every comment and the last review. If a review requested changes, address every point in it.',
      '3. Do the work in the current repository. Keep the change focused on the ticket.',
      '4. Use add_comment to record important decisions, assumptions and blockers as you go.',
      "5. Verify before you submit. When the work is code, run the relevant tests, type checks and build, and check that the change really works. Otherwise check the result against the ticket and the project's instructions.",
      '6. Call submit_for_review with a clear summary of what you changed and how you verified it, the files you created or edited, and next steps (or "none"). Then tell me what you did.',
      '',
      'Rules:',
      '- Never move a ticket to Done. Only a person does that, after review.',
      '- If you are blocked, use add_comment to explain why and what you need, leave the ticket In progress, and tell me.',
      '- Work on one ticket. Continue with the next ticket (back to step 1) only if I asked for more than one.',
    ].join('\n');
  },
};
