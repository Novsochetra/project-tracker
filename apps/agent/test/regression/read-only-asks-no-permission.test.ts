import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { claudeRunners } from '../../src/watch/claudeRunners';
import type { AskPerson } from '../../src/watch/permissionTool/askPerson';
import { questionsOnly, READ_ONLY_REFUSAL } from '../../src/watch/permissionTool/questionsOnly';
import type { PromptTool } from '../../src/watch/permissionTool/withPromptTool';
import { installFakeClaude } from '../watch/fakeClaude';
import { askJob } from '../watch/fakeTracker';

const fake = installFakeClaude();
afterAll(() => fake.remove());

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

const handed = vi.hoisted(() => [] as PromptTool[]);
vi.mock('../../src/watch/permissionTool/withPromptTool', () => ({
  openPromptTool: (tool: PromptTool) => {
    handed.push(tool);
    return Promise.resolve({ args: [], close: () => undefined });
  },
  withPromptTool: (
    tool: PromptTool,
    _run: unknown,
    start: (args: string[]) => Promise<unknown>,
  ) => {
    handed.push(tool);
    return start([]);
  },
}));

describe('regression: claudeRunners hands a read-only question the questions-only tool', () => {
  const signal = () => new AbortController().signal;
  const bash = { toolName: 'Bash', input: { command: 'rm -rf build' } };

  it.each(['ask', 'plan'] as const)('refuses a permission in a %s question', async (mode) => {
    const ask = vi.fn<AskPerson>();
    const claude = claudeRunners({
      command: fake.command,
      cwd: realpathSync(tmpdir()),
      write: () => undefined,
      prompts: { command: ['x'], ask },
    });
    handed.length = 0;
    const question = {
      ...askJob('r-2', 'c-1', null, { ...DEFAULT_ASK_OPTIONS, mode }),
      prompt: 'X',
    };
    await claude.runAsk(question, signal(), () => undefined);
    claude.closeChats();
    const tool = handed[0];
    expect(await tool?.ask(question.run, bash, signal())).toEqual({
      behavior: 'deny',
      message: READ_ONLY_REFUSAL,
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it('lets an Edit question ask for a permission', async () => {
    const ask = vi.fn<AskPerson>().mockResolvedValue({ behavior: 'allow', updatedInput: {} });
    const claude = claudeRunners({
      command: fake.command,
      cwd: realpathSync(tmpdir()),
      write: () => undefined,
      prompts: { command: ['x'], ask },
    });
    handed.length = 0;
    const edit = {
      ...askJob('r-3', 'c-1', null, { ...DEFAULT_ASK_OPTIONS, mode: 'edit' }),
      prompt: 'X',
    };
    await claude.runAsk(edit, signal(), () => undefined);
    claude.closeChats();
    await handed[0]?.ask(edit.run, bash, signal());
    expect(ask).toHaveBeenCalledOnce();
  });
});
