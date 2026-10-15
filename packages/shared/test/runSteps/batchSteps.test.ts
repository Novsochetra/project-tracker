import { describe, expect, it } from 'vitest';
import type { RunStepInput } from '../../src/domain/runStep';
import {
  batchTicketSteps,
  ticketRunIn,
  type BatchStepsSoFar,
} from '../../src/logic/runSteps/batchSteps';

const tickets = [
  { runId: 'run-12', ticketKey: 'PT-12' },
  { runId: 'run-13', ticketKey: 'PT-13' },
];
const none: BatchStepsSoFar = { owners: new Map(), starts: new Map() };

const start = (toolId: string, label: string): RunStepInput => ({
  kind: 'agent',
  label: `Start sub agent: ${label}`,
  subAgent: false,
  toolId,
});
const sub = (parentToolId: string, label: string, toolId = `${parentToolId}-${label}`) =>
  ({ kind: 'tool', label, subAgent: true, parentToolId, toolId }) satisfies RunStepInput;
const onTicket = (step: RunStepInput): RunStepInput => ({
  ...step,
  subAgent: false,
  parentToolId: null,
});

describe('ticketRunIn', () => {
  it('finds the one ticket of the batch a label names', () => {
    expect(ticketRunIn('Start sub agent: Work on pt-13', tickets)).toBe('run-13');
  });

  it('finds none for a key outside the batch, two keys, or no key', () => {
    expect(ticketRunIn('Use tracker: claim_ticket PT-99', tickets)).toBeNull();
    expect(ticketRunIn('Start sub agent: PT-12 and PT-13', tickets)).toBeNull();
    expect(ticketRunIn('Run npm test', tickets)).toBeNull();
    expect(ticketRunIn('Read PT-120.md', tickets)).toBeNull();
    expect(ticketRunIn('Read xPT-12', tickets)).toBeNull();
  });
});

describe('batchTicketSteps', () => {
  it("gives each sub agent's steps to the ticket its Start step names", () => {
    const a = start('toolu_a', 'PT-12 capture fix');
    const b = start('toolu_b', 'PT-13 sort order');
    const steps = [a, b, sub('toolu_a', 'Read a.ts'), sub('toolu_b', 'Read b.ts')];
    const routed = batchTicketSteps(steps, tickets, none);
    expect(routed.get('run-12')).toEqual([onTicket(a), onTicket(sub('toolu_a', 'Read a.ts'))]);
    expect(routed.get('run-13')).toEqual([onTicket(b), onTicket(sub('toolu_b', 'Read b.ts'))]);
  });

  it('ties a sub agent by its claim when the Start step names no ticket', () => {
    const a = start('toolu_a', 'Next ticket');
    const claim = sub('toolu_a', 'Use tracker: claim_ticket PT-13');
    const routed = batchTicketSteps([a, sub('toolu_a', 'Run ls'), claim], tickets, none);
    expect(routed.get('run-13')).toEqual([onTicket(a), onTicket(claim)]);
    expect(routed.has('run-12')).toBe(false);
  });

  it('uses the Start step and owners saved by earlier requests', () => {
    const a = start('toolu_a', 'Next ticket');
    const later = batchTicketSteps([sub('toolu_a', 'Use tracker: claim_ticket PT-12')], tickets, {
      owners: new Map(),
      starts: new Map([['toolu_a', a]]),
    });
    expect(later.get('run-12')?.[0]).toEqual(onTicket(a));
    const owned = batchTicketSteps([sub('toolu_b', 'Edit b.ts')], tickets, {
      owners: new Map([['toolu_b', 'run-13']]),
      starts: new Map(),
    });
    expect(owned.get('run-13')).toEqual([onTicket(sub('toolu_b', 'Edit b.ts'))]);
  });

  it("leaves the main conversation's own steps and other tickets' reads on the batch alone", () => {
    const a = start('toolu_a', 'PT-12');
    const steps: RunStepInput[] = [
      { kind: 'text', label: 'Starting PT-13 next.', subAgent: false, toolId: null },
      a,
      sub('toolu_a', 'Use tracker: get_ticket PT-13'),
    ];
    const routed = batchTicketSteps(steps, tickets, none);
    expect([...routed.keys()]).toEqual(['run-12']);
    expect(routed.get('run-12')?.map(({ label }) => label)).toEqual([
      'Start sub agent: PT-12',
      'Use tracker: get_ticket PT-13',
    ]);
  });

  it("ties a sub agent only by a call, never by Claude's words or a refused call", () => {
    const a = start('toolu_a', 'Next ticket');
    const words: RunStepInput = {
      kind: 'text',
      label: "I won't claim PT-13, another agent has it.",
      subAgent: true,
      parentToolId: 'toolu_a',
      toolId: null,
    };
    const refused: RunStepInput = {
      ...sub('toolu_a', 'Not allowed: Use tracker: claim_ticket PT-13'),
      kind: 'denied',
    };
    expect(batchTicketSteps([a, words, refused], tickets, none).size).toBe(0);
  });

  it('starts the ticket with a Start step even when the batch no longer has its own', () => {
    const claim = sub('toolu_a', 'Use tracker: claim_ticket PT-12');
    expect(batchTicketSteps([claim], tickets, none).get('run-12')).toEqual([
      {
        kind: 'agent',
        label: 'Start sub agent',
        subAgent: false,
        parentToolId: null,
        toolId: 'toolu_a',
      },
      onTicket(claim),
    ]);
  });

  it('keeps an agent the sub agent starts itself as a sub agent on the ticket', () => {
    const nested: RunStepInput = {
      ...sub('toolu_a', 'Start sub agent: check tests'),
      kind: 'agent',
    };
    const routed = batchTicketSteps([start('toolu_a', 'PT-12'), nested], tickets, none);
    expect(routed.get('run-12')?.map(({ subAgent }) => subAgent)).toEqual([false, true]);
  });
});
