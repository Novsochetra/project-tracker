import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { claudeArgs, claudeIsInstalled, runClaude } from '../../src/watch/claude';
import { installFakeClaude } from './fakeClaude';

const fake = installFakeClaude();
const cwd = realpathSync(tmpdir());
const run = (prompt: string, signal = new AbortController().signal, permissionMode?: string) =>
  runClaude(
    { command: fake.command, cwd, args: claudeArgs(permissionMode) },
    prompt,
    signal,
    () => undefined,
  );

afterAll(() => fake.remove());

describe('runClaude', () => {
  it('hands the prompt over on stdin, in the folder, so it can never become a flag', async () => {
    const exit = await run('--dangerously-skip-permissions fix MOB-1');
    expect(exit.code).toBe(0);
    expect(exit.output).toContain('ARGS ["-p"]');
    expect(exit.output).toContain(`CWD ${cwd}`);
    expect(exit.output).toContain('PROMPT --dangerously-skip-permissions fix MOB-1');
  });

  it('passes the permission mode the person chose', async () => {
    expect(claudeArgs('acceptEdits')).toEqual(['-p', '--permission-mode', 'acceptEdits']);
    expect((await run('go', undefined, 'plan')).output).toContain(
      'ARGS ["-p","--permission-mode","plan"]',
    );
  });

  it('reports a failing exit with what Claude printed', async () => {
    const exit = await run('FAIL please');
    expect(exit).toMatchObject({ code: 3 });
    expect(exit.output).toContain('boom');
  });

  it('stops Claude when the run is cancelled', async () => {
    const stop = new AbortController();
    const exit = run('WAIT', stop.signal);
    setTimeout(() => stop.abort(), 200);
    expect(await exit).toMatchObject({ code: null, signal: 'SIGTERM' });
  });

  it('says whether Claude Code is installed', async () => {
    expect(await claudeIsInstalled(fake.command)).toBe(true);
    expect(await claudeIsInstalled(`${fake.dir}/missing`)).toBe(false);
  });
});
