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

export const RUN_TODO_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type RunTodoStatus = (typeof RUN_TODO_STATUSES)[number];
// A to-do item is one line like a step's label; past this many the rest of the list is left out.
export const RUN_TODOS_MAX = 30;

export interface RunTodo {
  text: string;
  status: RunTodoStatus;
}

export interface RunStepInput {
  kind: RunStepKind;
  label: string;
  // Sent by a sub agent rather than the main conversation, so the phone can indent it.
  subAgent: boolean;
  // A sub agent's steps name the call that started it, so a Run all can give them to its ticket.
  parentToolId?: string | null;
  // Claude Code's id for the tool call, which ties a call to what became of it; null for text.
  toolId: string | null;
  // Claude's to-do list as its TodoWrite call wrote it. The tracker keeps only a run's latest one,
  // so an earlier call's list reads back empty.
  todos?: RunTodo[];
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
