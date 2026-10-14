import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULT_ASK_OPTIONS, type AskMode } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { claudeRunners } from '../../src/watch/claudeRunners';
import type { AskPerson } from '../../src/watch/permissionTool/askPerson';
import { askJob, job } from '../watch/fakeTracker';
import { installFakeClaude } from '../watch/fakeClaude';

const fake = installFakeClaude();
afterAll(() => fake.remove());

// The runners tracker watch builds, for a helper started with --permission-mode bypassPermissions,
// with the prompt tool that lets Claude ask the person.
const askPerson = vi.fn<AskPerson>();
const claude = claudeRunners({
  command: fake.command,
  cwd: realpathSync(tmpdir()),
  permissionMode: 'bypassPermissions',
  write: () => undefined,
  prompts: { command: ['node', 'promptTool.js'], ask: askPerson },
});

const PROMPT_TOOL_ARGS = [
  '--mcp-config',
  expect.stringContaining('"tracker-watch"'),
  '--permission-prompt-tool',
  'mcp__tracker-watch__ask_person',
];

const noSteps = () => undefined;

const ask = async (prompt: string, resume: string | null = null, mode: AskMode = 'ask') => {
  const job = { ...askJob('r-1', 'c-1', resume, { ...DEFAULT_ASK_OPTIONS, mode }), prompt };
  return askOutcomeOf(await claude.runAsk(job, new AbortController().signal, noSteps), false);
};

const STREAM = ['-p', '--output-format', 'stream-json', '--verbose'];

const READ_ONLY_ARGS = [
  ...STREAM,
  '--permission-mode',
  'plan',
  '--strict-mcp-config',
  '--disallowedTools',
  'Edit',
  'Write',
  'NotebookEdit',
];

const argsOf = (answer = '') => JSON.parse(/^ARGS (.*)$/m.exec(answer)?.[1] ?? '[]') as string[];

// A chat question must never change the folder, whatever the helper was started with, and the
// question is text on stdin, never a flag.
describe('regression: an ask runs Claude read-only', () => {
  it('starts claude in plan mode with no MCP servers and no edit tools', async () => {
    const outcome = await ask('--dangerously-skip-permissions where is X?');
    expect(outcome.status).toBe('done');
    const args = argsOf(outcome.answer);
    expect(args).toEqual([...READ_ONLY_ARGS, ...PROMPT_TOOL_ARGS]);
    expect(args).not.toContain('bypassPermissions');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(outcome.answer).toContain('PROMPT --dangerously-skip-permissions where is X?');
  });

  it('keeps a Plan question read-only too', async () => {
    const args = argsOf((await ask('Plan X', null, 'plan')).answer);
    expect(args).toEqual([...READ_ONLY_ARGS, ...PROMPT_TOOL_ARGS]);
  });

  it("gives an older server's question with no options the read-only flags", async () => {
    const job = { ...askJob('r-1', 'c-1'), prompt: 'where?' };
    const outcome = askOutcomeOf(
      await claude.runAsk(job, new AbortController().signal, noSteps),
      false,
    );
    expect(argsOf(outcome.answer)).toEqual([...READ_ONLY_ARGS, ...PROMPT_TOOL_ARGS]);
  });

  it('lets an Ask or Plan question ask the person, with no other MCP server', async () => {
    for (const mode of ['ask', 'plan'] as const) {
      const args = argsOf((await ask('Delete X', null, mode)).answer);
      expect(args).toEqual([...READ_ONLY_ARGS, ...PROMPT_TOOL_ARGS]);
    }
  });

  it("gives an Edit question the helper's mode, the tracker MCP, the edit tools and the prompt tool", async () => {
    const args = argsOf((await ask('Rename X', null, 'edit')).answer);
    expect(args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
      ...PROMPT_TOOL_ARGS,
    ]);
    expect(args).not.toContain('--strict-mcp-config');
    expect(args).not.toContain('--disallowedTools');
  });

  it('still gives ticket runs the mode the person chose', async () => {
    const exit = await claude.runClaude(job('r-1', 'MOB-1'), new AbortController().signal, noSteps);
    expect(argsOf(exit.results[0]?.text)).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
      ...PROMPT_TOOL_ARGS,
    ]);
  });

  it('asks the person in an Edit question, not a ticket run, when the helper got no mode', async () => {
    const noMode = claudeRunners({
      command: fake.command,
      cwd: realpathSync(tmpdir()),
      write: () => undefined,
      prompts: { command: ['node', 'promptTool.js'], ask: askPerson },
    });
    const editJob = {
      ...askJob('r-1', 'c-1', null, { ...DEFAULT_ASK_OPTIONS, mode: 'edit' }),
      prompt: 'X',
    };
    const edit = askOutcomeOf(
      await noMode.runAsk(editJob, new AbortController().signal, noSteps),
      false,
    );
    expect(argsOf(edit.answer)).toEqual([
      ...STREAM,
      '--permission-mode',
      'default',
      ...PROMPT_TOOL_ARGS,
    ]);
    for (const mode of ['ask', 'plan'] as const) {
      const readOnly = {
        ...askJob('r-1', 'c-1', null, { ...DEFAULT_ASK_OPTIONS, mode }),
        prompt: 'X',
      };
      const outcome = askOutcomeOf(
        await noMode.runAsk(readOnly, new AbortController().signal, noSteps),
        false,
      );
      expect(argsOf(outcome.answer)).toEqual([...READ_ONLY_ARGS, ...PROMPT_TOOL_ARGS]);
    }
    const ticket = await noMode.runClaude(
      job('r-2', 'MOB-1'),
      new AbortController().signal,
      noSteps,
    );
    expect(argsOf(ticket.results[0]?.text)).toEqual([...STREAM, ...PROMPT_TOOL_ARGS]);
  });

  it("resumes the chat's session and hands back the new one", async () => {
    const session = '99999999-2222-4333-8444-555555555555';
    const outcome = await ask('and then?', session);
    expect(argsOf(outcome.answer)).toEqual(expect.arrayContaining(['--resume', session]));
    expect(outcome.sessionId).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('reports why Claude could not answer', async () => {
    expect(await ask('ASK FAIL')).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nCredit balance is too low',
    });
  });
});
