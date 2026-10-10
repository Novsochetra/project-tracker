import type { RunStep } from '@tracker/shared';

export interface StepRow extends RunStep {
  // A call that was not allowed. Its `denied` step follows it, maybe after other steps, and shows
  // why; the call itself is marked so it doesn't read as done.
  refused: boolean;
}

export function stepRows(steps: readonly RunStep[]): StepRow[] {
  const refused = new Set(
    steps.flatMap(({ kind, toolId }) => (kind === 'denied' && toolId ? [toolId] : [])),
  );
  return steps.map((step) => ({
    ...step,
    refused: step.kind !== 'denied' && step.toolId !== null && refused.has(step.toolId),
  }));
}
