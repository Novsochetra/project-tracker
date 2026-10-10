import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { AskMode } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { claudeRunners } from '../../src/watch/claudeRunners';
import { askJob } from '../watch/fakeTracker';
import { installFakeClaude } from '../watch/fakeClaude';

const fake = installFakeClaude();
afterAll(() => fake.remove());

// The runners tracker watch builds, for a helper started with --permission-mode bypassPermissions.
const claude = claudeRunners({
  command: fake.command,
  cwd: realpathSync(tmpdir()),
  permissionMode: 'bypassPermissions',
  write: () => undefined,
});

const ask = async (prompt: string, resume: string | null = null, mode: AskMode = 'ask') => {
  const job = { ...askJob('r-1', 'c-1', resume, { model: 'default', mode }), prompt };
  return askOutcomeOf(await claude.runAsk(job, new AbortController().signal), false);
};

const READ_ONLY_ARGS = [
  '-p',
  '--output-format',
  'json',
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
    expect(args).toEqual(READ_ONLY_ARGS);
    expect(args).not.toContain('bypassPermissions');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(outcome.answer).toContain('PROMPT --dangerously-skip-permissions where is X?');
  });

  it('keeps a Plan question read-only too', async () => {
    const args = argsOf((await ask('Plan X', null, 'plan')).answer);
    expect(args).toEqual(READ_ONLY_ARGS);
  });

  it("gives an older server's question with no options the read-only flags", async () => {
    const job = { ...askJob('r-1', 'c-1'), prompt: 'where?' };
    const outcome = askOutcomeOf(await claude.runAsk(job, new AbortController().signal), false);
    expect(argsOf(outcome.answer)).toEqual(READ_ONLY_ARGS);
  });

  it("gives an Edit question the helper's mode, the tracker MCP and the edit tools", async () => {
    const args = argsOf((await ask('Rename X', null, 'edit')).answer);
    expect(args).toEqual([
      '-p',
      '--output-format',
      'json',
      '--permission-mode',
      'bypassPermissions',
    ]);
    expect(args).not.toContain('--strict-mcp-config');
    expect(args).not.toContain('--disallowedTools');
  });

  it('still gives ticket runs the mode the person chose', async () => {
    const exit = await claude.runClaude('Fix MOB-1', new AbortController().signal);
    expect(exit.output).toContain('ARGS ["-p","--permission-mode","bypassPermissions"]');
  });

  it("resumes the chat's session and hands back the new one", async () => {
    const session = '99999999-2222-4333-8444-555555555555';
    const outcome = await ask('and then?', session);
    expect(argsOf(outcome.answer).slice(-2)).toEqual(['--resume', session]);
    expect(outcome.sessionId).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('reports why Claude could not answer', async () => {
    expect(await ask('ASK FAIL')).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nCredit balance is too low',
    });
  });
});
