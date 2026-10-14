import type { ActivityRow } from '../db/schema';

// Events keep no field for a move, so these words are the only record of one; the review chain
// reads them back (reviewChain/chainFacts), so every move's event is built here.
export const WORKFLOW_VERBS = {
  send: 'sent the ticket to Claude Code',
  claim: 'picked up the ticket',
  submit: 'submitted the work',
  approve: 'approved the work',
  requestChanges: 'requested changes',
  // A person's verdict on the Changes tab (PT-229).
  approveChanges: 'approved the changes',
  askForChanges: 'asked for changes',
} as const;

export type WorkflowVerb = (typeof WORKFLOW_VERBS)[keyof typeof WORKFLOW_VERBS];

const STATUS_CHANGED = 'changed status to ';
const MOVED = ' and moved it to ';

export const statusChangedText = (statusName: string): string => `${STATUS_CHANGED}${statusName}`;

export const reportMoveText = (statusName: string): string =>
  `${statusChangedText(statusName)} from a Claude Code report`;

export const workflowMoveText = (verb: WorkflowVerb, statusName: string): string =>
  `${verb}${MOVED}${statusName}`;

const MOVE_STARTS = [
  STATUS_CHANGED,
  ...Object.values(WORKFLOW_VERBS).map((verb) => `${verb}${MOVED}`),
];

export const isStatusMove = (row: Pick<ActivityRow, 'type' | 'text'>): boolean =>
  row.type === 'event' && MOVE_STARTS.some((start) => row.text.startsWith(start));
