import type { Run } from '@tracker/shared';
import { TRACKER_MCP } from './trackerTools';

const EVERY_RUN = ['ask_person', 'get_ticket', 'add_comment', 'attach_file'];
// A worker can't record its own review without asking, nor a reviewer submit the work.
const BY_ROLE: Readonly<Record<Run['role'], readonly string[]>> = {
  work: ['submit_for_review'],
  review: ['review_ticket'],
};

// A batch's sub agents each claim and submit their own ticket (buildBatchPrompt).
const BATCH = ['claim_ticket', 'submit_for_review'];

const toolsOf = (run: Pick<Run, 'kind' | 'role'>): readonly string[] => {
  if (run.kind === 'batch') return BATCH;
  return run.kind === 'ticket' ? BY_ROLE[run.role] : [];
};

// The run prompts tell Claude to use these. Without an allow rule each one first asked the phone
// for permission, so ask_person showed "Claude asks for permission" before its own question.
export function trackerAllowedArgs(run: Pick<Run, 'kind' | 'role'>): string[] {
  const tools = [...EVERY_RUN, ...toolsOf(run)];
  return ['--allowedTools', tools.map((tool) => `mcp__${TRACKER_MCP}__${tool}`).join(',')];
}
