import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { claudeArgs, claudeIsInstalled, runClaude } from '../../src/watch/claude';
import { installFakeClaude } from './fakeClaude';

const fake = installFakeClaude();
const cwd = realpathSync(tmpdir());

function run(prompt: string, signal = new AbortController().signal, permissionMode?: string) {
  const shown: string[] = [];
  const events: unknown[] = [];
  const exit = runClaude(
    { command: fake.command, cwd, args: claudeArgs(permissionMode) },
    prompt,
    signal,
    {
      onOutput: (text) => shown.push(text),
      onEvent: (event) => events.push(event),
    },
  );
  return { exit, shown, events };
}

afterAll(() => fake.remove());

describe('runClaude', () => {
  it('hands the prompt over on stdin, in the folder, so it can never become a flag', async () => {
    const exit = await run('--dangerously-skip-permissions fix MOB-1').exit;
    expect(exit.code).toBe(0);
    expect(exit.result?.text).toContain('ARGS ["-p","--output-format","stream-json","--verbose"]');
    expect(exit.result?.text).toContain(`CWD ${cwd}`);
    expect(exit.result?.text).toContain('PROMPT --dangerously-skip-permissions fix MOB-1');
  });

  it('streams JSON events, and shows readable text only', async () => {
    const { exit, shown, events } = run('Fix MOB-1');
    const { result, output } = await exit;
    expect(events.map((event) => (event as { type: string }).type)).toEqual([
      'system',
      'assistant',
      'assistant',
      'result',
    ]);
    expect(result).toMatchObject({ isError: false, sessionId: expect.any(String) });
    expect(shown.join('')).toBe(`${result?.text}\n`);
    expect(output).toBe(`${result?.text}\n`);
    expect(output).not.toContain('"type"');
  });

  it('passes the permission mode the person chose', async () => {
    expect(claudeArgs('acceptEdits')).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'acceptEdits',
    ]);
    expect((await run('go', undefined, 'plan').exit).result?.text).toContain(
      '"--verbose","--permission-mode","plan"]',
    );
  });

  it('reports a failing exit with what Claude printed', async () => {
    const exit = await run('FAIL please').exit;
    expect(exit).toMatchObject({ code: 3 });
    expect(exit.output).toContain('boom');
  });

  it('stops Claude when the run is cancelled', async () => {
    const stop = new AbortController();
    const exit = run('WAIT', stop.signal).exit;
    setTimeout(() => stop.abort(), 200);
    expect(await exit).toMatchObject({ code: null, signal: 'SIGTERM', result: null });
  });

  it('says whether Claude Code is installed', async () => {
    expect(await claudeIsInstalled(fake.command)).toBe(true);
    expect(await claudeIsInstalled(`${fake.dir}/missing`)).toBe(false);
  });
});
