export const WORKFLOW_VERBS = {
  claim: 'picked up the ticket',
  submit: 'submitted the work',
  approve: 'approved the work',
  requestChanges: 'requested changes',
} as const;

export type WorkflowVerb = (typeof WORKFLOW_VERBS)[keyof typeof WORKFLOW_VERBS];

export const statusChangedText = (statusName: string): string => `changed status to ${statusName}`;

export const workflowMoveText = (verb: WorkflowVerb, statusName: string): string =>
  `${verb} and moved it to ${statusName}`;
