import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLocalFile, closeLocalFiles } from '../../src/files/localFile';

// Claude Code started in ~/.claude made ~/.claude/.credentials.json "a dot-file in the current
// folder", so a ticket could ask for it to be attached.
const home = realpathSync(mkdtempSync(join(tmpdir(), 'fake-home-')));
const claude = join(home, '.claude');
const project = join(home, 'code', 'app');
const worktree = join(project, '.claude', 'worktrees', 'pt-1');
mkdirSync(join(claude, 'projects'), { recursive: true });
mkdirSync(worktree, { recursive: true });
writeFileSync(join(claude, '.credentials.json'), '{"token": "secret"}');
writeFileSync(join(claude, 'projects', '.state.json'), '{}');
writeFileSync(join(claude, 'notes.md'), '# Notes');
writeFileSync(join(project, '.notes.md'), 'hidden');
writeFileSync(join(worktree, '.notes.md'), 'hidden');
writeFileSync(join(worktree, 'report.md'), '# Report');

afterAll(() => rmSync(home, { recursive: true, force: true }));

const refusal = (path: string) =>
  `Can't attach ${path}: its name starts with a dot and Claude Code runs in ${claude}, a ` +
  'dot-folder of your home folder, where keys and settings are kept.';

const attach = async (path: string, folder: string): Promise<string> => {
  const file = await checkLocalFile(path, [folder]);
  await closeLocalFiles([file]);
  return file.realPath;
};

describe('attaching from a dot-folder of the home folder', () => {
  beforeEach(() => vi.stubEnv('HOME', home));
  afterEach(() => vi.unstubAllEnvs());

  it('refuses a dot-file there, like the Claude Code credentials', async () => {
    for (const path of [
      join(claude, '.credentials.json'),
      join(claude, 'projects', '.state.json'),
    ]) {
      await expect(attach(path, claude)).rejects.toThrow(refusal(path));
    }
  });

  it('still takes a file whose name has no dot in front', async () => {
    await expect(attach(join(claude, 'notes.md'), claude)).resolves.toBe(join(claude, 'notes.md'));
  });

  it('still takes dot-files in a project and in its Claude Code worktrees', async () => {
    await expect(attach(join(project, '.notes.md'), project)).resolves.toBe(
      join(project, '.notes.md'),
    );
    for (const name of ['.notes.md', 'report.md']) {
      await expect(attach(join(worktree, name), worktree)).resolves.toBe(join(worktree, name));
    }
  });
});
