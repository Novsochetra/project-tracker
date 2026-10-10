// A tool or sub agent Claude asks for is shown as asked, since it may never run; a `denied` step
// follows, with the same toolId, when it was not allowed.
export const RUN_STEP_KINDS = ['tool', 'text', 'agent', 'denied'] as const;
export type RunStepKind = (typeof RUN_STEP_KINDS)[number];

// One line on a phone: a tool's name and a cut path or command, never its output.
export const RUN_STEP_LABEL_MAX = 160;
// Claude's words between tool calls. The answer itself still arrives whole with the run's end.
export const RUN_STEP_TEXT_MAX = 2000;
// Past this the oldest steps go, so a long run still shows its latest ones.
export const RUN_STEPS_KEPT = 500;
export const RUN_STEPS_BATCH_MAX = 100;

export interface RunStepInput {
  kind: RunStepKind;
  label: string;
  // Sent by a sub agent rather than the main conversation, so the phone can indent it.
  subAgent: boolean;
  // Claude Code's id for the tool call, which ties a call to what became of it; null for text.
  toolId: string | null;
}

export interface RunStep extends RunStepInput {
  // 1 for a run's first step and one more for each after it, so the last one's is how many the
  // run has had, the oldest dropped included.
  seq: number;
  at: number;
}

export interface RunStepEvent {
  type: 'run-step';
  runId: string;
  projectId: string;
  ticketId: string | null;
  chatId: string | null;
  count: number;
}
