import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli/args';
import { EXIT_ERROR, EXIT_USAGE, runCli } from '../../src/cli/run';
import { lineFormat } from '../../src/cli/watchCommand';
import { USAGE } from '../../src/cli/usage';
import { memoryStore } from '../memoryStore';

async function cli(argv: string[]) {
  const stderr: string[] = [];
  const code = await runCli(argv, {
    env: {},
    store: Object.assign(memoryStore(), {
      path: join(mkdtempSync(join(tmpdir(), 'watch-')), 'config.json'),
    }),
    stdout: () => undefined,
    stderr: (text) => stderr.push(text),
    untilStopped: () => new Promise<void>(() => undefined),
  });
  return { code, stderr: stderr.join('\n') };
}

describe('tracker watch', () => {
  const path = process.env.PATH;

  afterEach(() => {
    process.env.PATH = path;
  });

  it('is in the usage', () => {
    expect(USAGE).toContain(
      '\n  watch [PROJECT] [--name NAME] [--permission-mode MODE] [--approvals] [--no-keep-awake] [--install | --uninstall | --check]\n',
    );
  });

  it('takes one project and only its own options', async () => {
    expect(await cli(['watch', 'MOB', 'WEB'])).toEqual({
      code: EXIT_USAGE,
      stderr:
        'Unexpected argument "WEB".\nUsage: tracker watch [PROJECT] [--name NAME] [--permission-mode MODE] [--approvals] [--no-keep-awake] [--install | --uninstall | --check]',
    });
    expect((await cli(['watch', '--title', 'x'])).stderr).toContain(
      '"watch" has no --title option.',
    );
    expect((await cli(['claim', 'MOB', '--name', 'x'])).stderr).toContain(
      '"claim" has no --name option.',
    );
  });

  it('takes one of --install, --uninstall and --check, and only for watch', async () => {
    expect((await cli(['watch', '--install', '--check'])).stderr).toContain(
      'Use one of --install, --uninstall and --check.',
    );
    expect((await cli(['projects', '--install'])).stderr).toContain(
      '"projects" has no --install option.',
    );
    expect((await cli(['login', '--install'])).stderr).toContain(
      '"login" has no --install option.',
    );
    expect((await cli(['watch', 'MOB', '--check'])).stderr).toContain(
      '--check takes no project or other options: run it in the folder.',
    );
    expect((await cli(['watch', '--uninstall', '--name', 'Mac'])).stderr).toContain(
      '--uninstall takes no project or other options',
    );
  });

  it('refuses --approvals with a mode that does not ask, and for --check and --uninstall', async () => {
    for (const mode of ['auto', 'bypassPermissions']) {
      expect(await cli(['watch', '--approvals', '--permission-mode', mode])).toEqual({
        code: EXIT_USAGE,
        stderr: expect.stringContaining(
          `--approvals asks on the phone before each step, but --permission-mode ${mode} doesn't. Use acceptEdits.`,
        ),
      });
    }
    expect((await cli(['watch', '--check', '--approvals'])).stderr).toContain(
      '--check takes no project or other options',
    );
    expect((await cli(['claim', 'MOB', '--approvals'])).stderr).toContain(
      '"claim" has no --approvals option.',
    );
    expect(parseCliArgs(['watch', '--approvals']).flags.approvals).toBe(true);
  });

  it('says so when Claude Code is not installed', async () => {
    process.env.PATH = '/nowhere';
    expect(await cli(['watch', 'MOB'])).toEqual({
      code: EXIT_ERROR,
      stderr: expect.stringMatching(
        /^(\S+ )?Error: Claude Code \(the claude command\) is not on PATH here\.$/,
      ),
    });
  });

  it('puts the time on each line only for the helper writing to a log', () => {
    const stamp = /^\d{4}-\d\d-\d\dT\S+Z /;
    const logged = lineFormat(parseCliArgs(['watch', 'MOB']), false)('Error: no\nmore');
    expect(logged.split('\n')).toEqual([
      expect.stringMatching(stamp),
      expect.stringMatching(stamp),
    ]);
    expect(lineFormat(parseCliArgs(['watch', 'MOB']), true)('Error: no')).toBe('Error: no');
    for (const flag of ['--install', '--uninstall', '--check']) {
      expect(lineFormat(parseCliArgs(['watch', flag]), false)('Installed: no.')).toBe(
        'Installed: no.',
      );
    }
  });
});
