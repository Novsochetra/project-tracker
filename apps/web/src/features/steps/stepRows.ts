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

const CUT = /…$/;

// An answered run's last words are the answer, shown right under its folded steps, so the open
// list leaves them out rather than repeat them; words that differ from the answer stay.
export function withoutAnswer(rows: StepRow[], answer: string): StepRow[] {
  const last = rows.at(-1);
  if (last?.kind !== 'text' || last.subAgent) return rows;
  const words = last.label.replace(CUT, '').trim();
  return words && answer.trim().startsWith(words) ? rows.slice(0, -1) : rows;
}
