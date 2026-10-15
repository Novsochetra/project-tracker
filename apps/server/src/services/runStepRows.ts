import type { RunStepInput } from '@tracker/shared';
import type { RunStepRow } from '../db/runTables';
import { todosColumn } from './runTodos';

export type StepIn = Pick<RunStepInput, 'kind' | 'label' | 'todos'> &
  Partial<Pick<RunStepInput, 'subAgent' | 'parentToolId' | 'toolId'>>;

export const asRunStep = (step: StepIn): RunStepInput => ({
  ...step,
  subAgent: step.subAgent ?? false,
  toolId: step.toolId ?? null,
});

export const rowsOf = (runId: string, steps: readonly StepIn[], count: number, at: number) =>
  steps.map((step, index): RunStepRow => ({
    runId,
    seq: count - steps.length + index + 1,
    kind: step.kind,
    label: step.label,
    subAgent: step.subAgent ? 1 : 0,
    toolId: step.toolId ?? null,
    todos: todosColumn(step),
    createdAt: at,
  }));
