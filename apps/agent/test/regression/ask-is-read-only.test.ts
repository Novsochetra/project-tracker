import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { askArgs } from '../../src/watch/ask/askArgs';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { runClaude } from '../../src/watch/claude';
import { installFakeClaude } from '../watch/fakeClaude';

const fake = installFakeClaude();
afterAll(() => fake.remove());

const ask = async (prompt: string, resume: string | null) => {
  const command = { command: fake.command, args: askArgs(resume), cwd: realpathSync(tmpdir()) };
  const exit = await runClaude(command, prompt, new AbortController().signal, () => undefined);
  return askOutcomeOf(exit, false);
};

const argsOf = (answer = '') => JSON.parse(/^ARGS (.*)$/m.exec(answer)?.[1] ?? '[]') as string[];

// A chat question must never change the folder, even on a helper started with
// --permission-mode bypassPermissions, and the question is text on stdin, never a flag.
describe('regression: an ask runs Claude read-only', () => {
  it('starts claude in plan mode with no MCP servers and no edit tools', async () => {
    const outcome = await ask('--dangerously-skip-permissions where is X?', null);
    expect(outcome.status).toBe('done');
    const args = argsOf(outcome.answer);
    expect(args).toEqual(askArgs(null));
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('bypassPermissions');
    expect(outcome.answer).toContain('PROMPT --dangerously-skip-permissions where is X?');
  });

  it("resumes the chat's session and hands back the new one", async () => {
    const session = '99999999-2222-4333-8444-555555555555';
    const outcome = await ask('and then?', session);
    expect(argsOf(outcome.answer).slice(-2)).toEqual(['--resume', session]);
    expect(outcome.sessionId).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('reports why Claude could not answer', async () => {
    expect(await ask('ASK FAIL', null)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nCredit balance is too low',
    });
  });
});
