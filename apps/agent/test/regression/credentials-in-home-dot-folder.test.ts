import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLocalFile, closeLocalFiles } from '../../src/files/localFile';

// Claude Code started in ~/.claude made ~/.claude/.credentials.json and ~/.claude/settings.json
// "files in the current folder", so a ticket could ask for them to be attached.
const home = realpathSync(mkdtempSync(join(tmpdir(), 'fake-home-')));
const temp = realpathSync(mkdtempSync(join(tmpdir(), 'fake-temp-')));
const claude = join(home, '.claude');
const aws = join(home, '.aws');
const project = join(home, 'code', 'app');
const worktree = join(project, '.claude', 'worktrees', 'pt-1');
mkdirSync(claude, { recursive: true });
mkdirSync(aws, { recursive: true });
mkdirSync(worktree, { recursive: true });
writeFileSync(join(claude, '.credentials.json'), '{"token": "secret"}');
writeFileSync(join(claude, 'settings.json'), '{}');
writeFileSync(join(aws, 'credentials'), 'secret');
writeFileSync(join(aws, 'config.md'), '# Config');
writeFileSync(join(temp, 'report.md'), '# Report');
writeFileSync(join(project, '.notes.md'), 'hidden');
writeFileSync(join(worktree, '.notes.md'), 'hidden');
writeFileSync(join(worktree, 'report.md'), '# Report');

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(temp, { recursive: true, force: true });
});

const refusal = (path: string, folder: string) =>
  `Can't attach ${path}: Claude Code runs in ${folder}, a dot-folder of your home folder where ` +
  'keys and settings are kept, so only files in a temp folder can be attached. Start it in a ' +
  'project folder instead.';

const attach = async (path: string, folders: string[]): Promise<string> => {
  const file = await checkLocalFile(path, folders);
  await closeLocalFiles([file]);
  return file.realPath;
};

describe('attaching from a dot-folder of the home folder', () => {
  beforeEach(() => vi.stubEnv('HOME', home));
  afterEach(() => vi.unstubAllEnvs());

  it('refuses every file there, named with a dot in front or not', async () => {
    for (const [folder, name] of [
      [claude, '.credentials.json'],
      [claude, 'settings.json'],
      [aws, 'credentials'],
      [aws, 'config.md'],
    ] as const) {
      const path = join(folder, name);
      await expect(attach(path, [folder])).rejects.toThrow(refusal(path, folder));
    }
  });

  it('still takes a file from a temp folder', async () => {
    await expect(attach(join(temp, 'report.md'), [claude, temp])).resolves.toBe(
      join(temp, 'report.md'),
    );
  });

  it('still takes dot-files in a project and in its Claude Code worktrees', async () => {
    await expect(attach(join(project, '.notes.md'), [project])).resolves.toBe(
      join(project, '.notes.md'),
    );
    for (const name of ['.notes.md', 'report.md']) {
      await expect(attach(join(worktree, name), [worktree])).resolves.toBe(join(worktree, name));
    }
  });
});
