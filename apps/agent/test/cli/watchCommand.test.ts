import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EXIT_ERROR, EXIT_USAGE, runCli } from '../../src/cli/run';
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
      '\n  watch [PROJECT] [--name NAME] [--permission-mode MODE] [--no-keep-awake] [--install | --uninstall | --check]\n',
    );
  });

  it('takes one project and only its own options', async () => {
    expect(await cli(['watch', 'MOB', 'WEB'])).toEqual({
      code: EXIT_USAGE,
      stderr:
        'Unexpected argument "WEB".\nUsage: tracker watch [PROJECT] [--name NAME] [--permission-mode MODE] [--no-keep-awake] [--install | --uninstall | --check]',
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
  });

  it('says so when Claude Code is not installed', async () => {
    process.env.PATH = '/nowhere';
    expect(await cli(['watch', 'MOB'])).toEqual({
      code: EXIT_ERROR,
      stderr: 'Error: Claude Code (the claude command) is not on PATH here.',
    });
  });
});
