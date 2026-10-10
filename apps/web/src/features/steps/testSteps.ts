import type { RunStep } from '@tracker/shared';

export const makeStep = (seq: number, overrides: Partial<RunStep> = {}): RunStep => ({
  seq,
  at: 1_000 * seq,
  kind: 'tool',
  label: `Read apps/web/src/file${seq}.ts`,
  subAgent: false,
  toolId: `toolu_${seq}`,
  ...overrides,
});

export const makeSteps = (count: number, from = 1): RunStep[] =>
  Array.from({ length: count }, (_, index) => makeStep(from + index));
