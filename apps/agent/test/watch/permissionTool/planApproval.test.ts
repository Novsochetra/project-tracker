import {
  DEFAULT_ASK_OPTIONS,
  type AddRunRequestInput,
  type AskMode,
  type RunRequest,
} from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createAskPerson, type AskPerson } from '../../../src/watch/permissionTool/askPerson';
import { decisionOf, NO_ANSWER } from '../../../src/watch/permissionTool/decisionOf';
import {
  KEEP_PLANNING,
  keepPlanningWith,
  planApproved,
} from '../../../src/watch/permissionTool/planDecision';
import { questionsOnly, READ_ONLY_REFUSAL } from '../../../src/watch/permissionTool/questionsOnly';
import { askJob, RUNNER } from '../fakeTracker';
import { permissionRequest } from './requests';

// The shape Claude Code 2.1.299 sends to the permission prompt tool when it ends plan mode.
const exitPlan = {
  toolName: 'ExitPlanMode',
  input: { plan: '# Plan\n\n1. Add the route', planFilePath: '/Users/dara/.claude/plans/x.md' },
};
const runIn = (mode: AskMode) => askJob('r-1', 'c-1', null, { ...DEFAULT_ASK_OPTIONS, mode }).run;
const signal = () => new AbortController().signal;
const planRequest = (changes: Partial<RunRequest>) =>
  permissionRequest({ kind: 'plan', label: '# Plan', ...changes } as Partial<RunRequest>);

describe('a Plan question asks the person to approve its plan', () => {
  it('passes ExitPlanMode on in a Plan question only', async () => {
    const ask = vi.fn<AskPerson>().mockResolvedValue({ behavior: 'deny', message: 'x' });
    const tool = questionsOnly({ command: ['x'], ask });
    await tool.ask(runIn('plan'), exitPlan, signal());
    expect(ask).toHaveBeenCalledOnce();
    expect(await tool.ask(runIn('ask'), exitPlan, signal())).toEqual({
      behavior: 'deny',
      message: READ_ONLY_REFUSAL,
    });
    expect(ask).toHaveBeenCalledOnce();
  });

  it('sends the plan text as a plan request, and logs none of it', async () => {
    const asked: AddRunRequestInput[] = [];
    const log: string[] = [];
    const ask = createAskPerson({
      api: {
        addRunRequest: vi.fn((_id: string, input: AddRunRequestInput) => {
          asked.push(input);
          return Promise.resolve(planRequest({}));
        }),
        waitForRunRequest: vi.fn(() =>
          Promise.resolve(
            planRequest({ status: 'answered', decision: 'allow', answers: ['auto'] }),
          ),
        ),
        cancelRunRequest: vi.fn(),
      },
      runnerId: RUNNER,
      folder: '/Users/dara/app',
      log: (text) => log.push(text),
      describe: String,
    });
    expect(await ask(runIn('plan'), exitPlan, signal())).toEqual({
      behavior: 'deny',
      message: planApproved('auto'),
    });
    expect(asked).toEqual([
      {
        runnerId: RUNNER,
        kind: 'plan',
        label: '# Plan\n\n1. Add the route',
        labelCut: false,
        questions: null,
      },
    ]);
    expect(log[0]).toBe('chat c-1: Claude posted a plan on the phone.');
    expect(log.join('\n')).not.toContain('Plan');
  });

  it('asks an Edit question to leave plan mode like any permission', async () => {
    const asked: AddRunRequestInput[] = [];
    const ask = createAskPerson({
      api: {
        addRunRequest: vi.fn((_id: string, input: AddRunRequestInput) => {
          asked.push(input);
          return Promise.resolve(permissionRequest());
        }),
        waitForRunRequest: vi.fn(() =>
          Promise.resolve(permissionRequest({ status: 'answered', decision: 'allow' })),
        ),
        cancelRunRequest: vi.fn(),
      },
      runnerId: RUNNER,
      folder: '/Users/dara/app',
      log: () => undefined,
      describe: String,
    });
    expect(await ask(runIn('edit'), exitPlan, signal())).toEqual({
      behavior: 'allow',
      updatedInput: exitPlan.input,
    });
    expect(asked[0]?.kind).toBe('permission');
  });
});

describe('the answer to a plan', () => {
  it('ends the turn on approval and names the picked mode', () => {
    const edit = planRequest({ status: 'answered', decision: 'allow', answers: ['edit'] });
    expect(decisionOf(exitPlan, edit)).toEqual({ behavior: 'deny', message: planApproved('edit') });
    expect(planApproved('edit')).toContain('in Edit mode');
    expect(planApproved('auto')).toContain('in Auto mode');
  });

  it('keeps planning with the note, or asks what to change without one', () => {
    const note = planRequest({ status: 'answered', decision: 'deny', answers: ['Add tests'] });
    expect(decisionOf(exitPlan, note)).toEqual({
      behavior: 'deny',
      message: keepPlanningWith('Add tests'),
    });
    expect(keepPlanningWith('Add tests')).toContain('Add tests');
    const bare = planRequest({ status: 'answered', decision: 'deny' });
    expect(decisionOf(exitPlan, bare)).toEqual({ behavior: 'deny', message: KEEP_PLANNING });
  });

  it('goes on without an answer when nobody approves in time', () => {
    expect(decisionOf(exitPlan, planRequest({ status: 'expired' }))).toEqual({
      behavior: 'deny',
      message: NO_ANSWER,
    });
  });
});
