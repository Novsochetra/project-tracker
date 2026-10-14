import { describe, expect, it } from 'vitest';
import { addRunRequestInput } from '../src/api/runRequests';
import { RUN_PLAN_MAX } from '../src/domain/runRequest';
import { planPush } from '../src/logic/pushMessages';
import { answerProblem } from '../src/logic/runRequests/answerProblem';
import { buildAskPrompt } from '../src/logic/askPrompt';
import {
  approvedPlanBlock,
  NO_PLAN_TEXT,
  planModeOf,
  planRequestOf,
  takesPlans,
} from '../src/logic/runRequests/planRequest';

const runnerId = '0b8f8f7e-6a35-4a9b-9a4f-2f3c4d5e6f70';
const plan = { kind: 'plan' as const, questions: null, labelCut: false };

describe('planRequestOf', () => {
  // The shape Claude Code 2.1.299 sends to the permission prompt tool: its plan file's text.
  it('shows the plan file Claude Code put in the call', () => {
    const input = { plan: '\n# Plan\n\n1. Add the route\n', planFilePath: '/x/plan.md' };
    expect(planRequestOf(input)).toEqual({
      kind: 'plan',
      label: '# Plan\n\n1. Add the route',
      labelCut: false,
      questions: null,
    });
  });

  it('still asks when the call holds no plan', () => {
    expect(planRequestOf({})).toMatchObject({ label: NO_PLAN_TEXT, labelCut: false });
    expect(planRequestOf({ plan: 42 })).toMatchObject({ label: NO_PLAN_TEXT });
  });

  it('cuts a huge plan at its limit and says so', () => {
    const request = planRequestOf({ plan: 'a'.repeat(RUN_PLAN_MAX + 10) });
    expect(request.label.length).toBeLessThanOrEqual(RUN_PLAN_MAX);
    expect(request.labelCut).toBe(true);
  });
});

describe('takesPlans', () => {
  it('is true only for a Plan question', () => {
    expect(takesPlans('ask', 'plan')).toBe(true);
    expect(takesPlans('ask', 'ask')).toBe(false);
    expect(takesPlans('ask', 'edit')).toBe(false);
    expect(takesPlans('ticket', null)).toBe(false);
  });
});

describe('planModeOf', () => {
  it('reads one known mode only', () => {
    expect(planModeOf(['edit'])).toBe('edit');
    expect(planModeOf(['auto'])).toBe('auto');
    expect(planModeOf(['plan'])).toBeNull();
    expect(planModeOf(['edit', 'auto'])).toBeNull();
    expect(planModeOf(null)).toBeNull();
  });
});

describe('answerProblem for a plan', () => {
  it('approves with the mode to carry it out in', () => {
    expect(answerProblem(plan, { decision: 'allow', answers: ['auto'] })).toBeUndefined();
    expect(answerProblem(plan, { decision: 'allow' })).toMatch(/edit or auto/);
    expect(answerProblem(plan, { decision: 'allow', answers: ['ask'] })).toMatch(/edit or auto/);
  });

  it('approves a plan cut at its limit in Edit only', () => {
    const cut = { ...plan, labelCut: true };
    expect(answerProblem(cut, { decision: 'allow', answers: ['edit'] })).toBeUndefined();
    expect(answerProblem(cut, { decision: 'allow', answers: ['auto'] })).toMatch(/Edit only/);
  });

  it('keeps planning with one note or none', () => {
    expect(answerProblem(plan, { decision: 'deny' })).toBeUndefined();
    expect(answerProblem(plan, { decision: 'deny', answers: ['Add tests'] })).toBeUndefined();
    expect(answerProblem(plan, { decision: 'deny', answers: ['a', 'b'] })).toMatch(/one note/);
  });
});

describe('addRunRequestInput for a plan', () => {
  it('takes a long plan up to its own limit', () => {
    const input = { runnerId, kind: 'plan', label: 'p'.repeat(RUN_PLAN_MAX), labelCut: false };
    expect(addRunRequestInput.parse({ ...input, questions: null })).toMatchObject(input);
    expect(() =>
      addRunRequestInput.parse({ ...input, label: `${input.label}p`, questions: null }),
    ).toThrow();
  });
});

describe('planPush', () => {
  it('says a plan waits, never what it says', () => {
    const chat = { projectKey: 'MOB', projectName: 'Mobile', chatId: 'c-1', title: 'Login' };
    expect(planPush({ chat })).toEqual({
      title: 'Claude has a plan for you: Login',
      body: 'Mobile · Open the chat to approve it.',
      url: '/p/MOB/ask/c-1',
      tag: 'chat:c-1',
    });
    const ticket = { projectKey: 'MOB', num: 3, title: 'Fix login' };
    expect(planPush({ ticket }).title).toBe('MOB-3: Claude has a plan for you');
  });
});

describe('the approved plan in the prompt', () => {
  it('quotes every line of the plan after the question', () => {
    expect(approvedPlanBlock('# Plan\n\n1. Add it')).toBe(
      'The plan they approved:\n\n> # Plan\n> \n> 1. Add it',
    );
    const project = { key: 'MOB', name: 'Mobile', instructions: '' };
    const prompt = buildAskPrompt({
      project,
      mode: 'auto',
      question: 'Carry out the approved plan.',
      history: [],
      plan: '1. Add it',
    });
    expect(
      prompt.endsWith(
        'Question:\nCarry out the approved plan.\n\n---\n\nThe plan they approved:\n\n> 1. Add it',
      ),
    ).toBe(true);
    expect(buildAskPrompt({ project, mode: 'auto', question: 'q', history: [] })).not.toContain(
      'The plan they approved',
    );
  });
});
