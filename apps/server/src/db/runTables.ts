import type {
  AskEffort,
  AskMode,
  AskModel,
  ChainStop,
  RunKind,
  RunRequestDecision,
  RunRequestKind,
  RunRequestStatus,
  RunRole,
  RunStatus,
  RunStepKind,
} from '@tracker/shared';

export interface RunnerRow {
  id: string;
  userId: string | null;
  name: string;
  // Ids, not keys, so renaming a project keeps its helpers.
  projectIds: string;
  // RunnerTools as JSON text (§2); null from a helper that sends none.
  tools: string | null;
  // StoredPlanLimits as JSON text (PT-224); null until a run end carries them.
  planLimits: string | null;
  createdAt: number;
  lastSeenAt: number;
}

export interface RunRow {
  id: string;
  userId: string | null;
  projectId: string;
  ticketId: string | null;
  runnerId: string | null;
  // Copied, so the run still names its computer after the computer is removed.
  runnerName: string;
  prompt: string;
  status: RunStatus;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  kind: RunKind;
  chatId: string | null;
  // Copied from the chat when the run is queued on the helper that holds that session.
  resumeSessionId: string | null;
  // The question's choice; null on ticket runs and on asks queued before options.
  askModel: AskModel | null;
  askMode: AskMode | null;
  askEffort: AskEffort | null;
  stepCount: number;
  // Null on runs queued before there were roles, which were all work runs.
  role: RunRole | null;
  costMicros: number | null;
  turns: number | null;
  durationMs: number | null;
  contextTokens: number | null;
  contextWindow: number | null;
  tokens: number | null;
  // The chain's work round (logic/reviewChain); null on a run a person started.
  round: number | null;
  chainStop: ChainStop | null;
  // So the helper is given the files of the question it answers.
  questionId: string | null;
  // The batch run that holds this ticket's run: the batch's Claude works on it, no helper takes it.
  batchId: string | null;
}

export type RunUsageColumns = Pick<
  RunRow,
  'costMicros' | 'turns' | 'durationMs' | 'contextTokens' | 'contextWindow' | 'tokens'
>;

export interface RunStepRow {
  runId: string;
  seq: number;
  kind: RunStepKind;
  label: string;
  // 0 or 1: neither database's boolean is portable.
  subAgent: number;
  toolId: string | null;
  // A TodoWrite call's list as JSON; '[]' once a later call's list replaced it.
  todos: string | null;
  createdAt: number;
}

export interface RunRequestRow {
  id: string;
  runId: string;
  kind: RunRequestKind;
  label: string;
  // 0 or 1: no booleans (§2).
  labelCut: number;
  // JSON as text, like runners.project_ids: no JSON columns (§2). Null for a permission.
  questions: string | null;
  status: RunRequestStatus;
  decision: RunRequestDecision | null;
  answers: string | null;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
}

export interface RunTables {
  runners: RunnerRow;
  runs: RunRow;
  runSteps: RunStepRow;
  runRequests: RunRequestRow;
}
