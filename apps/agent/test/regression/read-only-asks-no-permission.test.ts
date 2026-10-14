import { describe, expect, it, vi } from 'vitest';
import type { AskPerson } from '../../src/watch/permissionTool/askPerson';
import { questionsOnly, READ_ONLY_REFUSAL } from '../../src/watch/permissionTool/questionsOnly';
import { askJob } from '../watch/fakeTracker';

// Merging PT-230 with main: every run got the prompt tool, so an Ask or Plan question could have
// asked the person to allow a command, and one tap would have let a read-only run change things.
describe('regression: a read-only question asks only questions', () => {
  const run = askJob('r-1', 'c-1').run;
  const signal = new AbortController().signal;

  it('passes a question on to the person', async () => {
    const ask = vi.fn<AskPerson>().mockResolvedValue({ behavior: 'allow', updatedInput: {} });
    const call = { toolName: 'AskUserQuestion', input: { questions: [] } };
    await questionsOnly({ command: ['x'], ask }).ask(run, call, signal);
    expect(ask).toHaveBeenCalledWith(run, call, signal);
  });

  it('refuses a permission without asking', async () => {
    const ask = vi.fn<AskPerson>();
    const call = { toolName: 'Bash', input: { command: 'rm -rf build' } };
    const answer = await questionsOnly({ command: ['x'], ask }).ask(run, call, signal);
    expect(answer).toEqual({ behavior: 'deny', message: READ_ONLY_REFUSAL });
    expect(ask).not.toHaveBeenCalled();
  });
});
