import { describe, expect, it } from 'vitest';
import { latestStep, stepLine } from './stepLine';
import { stepRows } from './stepRows';
import { makeStep } from './testSteps';

describe('stepLine', () => {
  it('is the label of a call, a sub agent or a refusal', () => {
    expect(stepLine({ kind: 'tool', label: 'Run npm run verify' })).toBe('Run npm run verify');
    expect(stepLine({ kind: 'agent', label: 'Start sub agent: Find it' })).toBe(
      'Start sub agent: Find it',
    );
    expect(stepLine({ kind: 'denied', label: 'Not allowed: Run ls' })).toBe('Not allowed: Run ls');
  });

  it('is the first line Claude wrote that holds words', () => {
    expect(stepLine({ kind: 'text', label: '\n  I found it.  \nIt is in runQueue.ts.' })).toBe(
      'I found it.',
    );
  });
});

describe('latestStep', () => {
  it('is the newest step, or none before the first', () => {
    const rows = stepRows([makeStep(1), makeStep(2, { label: 'Run npm test' })]);
    expect(latestStep(rows)?.label).toBe('Run npm test');
    expect(latestStep([])).toBeNull();
  });
});
