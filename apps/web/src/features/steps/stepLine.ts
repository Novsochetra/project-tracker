import type { StepRow } from './stepRows';

// Claude's words can run to many lines; one line says what it is doing now.
export function stepLine(row: Pick<StepRow, 'kind' | 'label'>): string {
  if (row.kind !== 'text') return row.label;
  return (
    row.label
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? row.label
  );
}

export const latestStep = (rows: readonly StepRow[]): StepRow | null => rows.at(-1) ?? null;
