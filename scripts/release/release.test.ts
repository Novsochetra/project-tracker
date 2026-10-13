import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { release } from './release';

// A throwaway repo, away from the user's git config (signing, hooks) and this repo's tags.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

let dir: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function commitFile(name: string, text: string, subject: string) {
  writeFileSync(join(dir, name), text);
  git('add', name);
  git('commit', '--quiet', '-m', subject);
}

beforeEach(() => {
  for (const [name, value] of Object.entries(GIT_ENV)) vi.stubEnv(name, value);
  dir = mkdtempSync(join(tmpdir(), 'tracker-release-'));
  git('init', '--quiet', '-b', 'main');
  writeFileSync(join(dir, 'package.json'), json({ name: 'app', version: '1.0.0' }));
  writeFileSync(join(dir, 'package-lock.json'), json({ name: 'app', packages: { '': {} } }));
  writeFileSync(join(dir, 'CHANGELOG.md'), '# Changelog\n\n## v1.0.0 (2026-10-13)\n\n- First\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'Start');
  git('tag', '-a', 'v1.0.0', '-m', 'Release v1.0.0');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const run = () => release({ cwd: dir, part: 'minor', day: '2026-10-14' });

describe('release', () => {
  it('bumps, writes the changelog, commits and tags', () => {
    commitFile('a.txt', 'a', 'Add a (PT-1)');
    commitFile('b.txt', 'b', 'Add b (PT-2)');

    expect(run()).toEqual({
      version: '1.1.0',
      tag: 'v1.1.0',
      subjects: ['Add b (PT-2)', 'Add a (PT-1)'],
    });
    expect(JSON.parse(read('package.json'))).toEqual({ name: 'app', version: '1.1.0' });
    expect(JSON.parse(read('package-lock.json'))).toMatchObject({
      version: '1.1.0',
      packages: { '': { version: '1.1.0' } },
    });
    expect(read('CHANGELOG.md')).toBe(
      '# Changelog\n\n## v1.1.0 (2026-10-14)\n\n- Add b (PT-2)\n- Add a (PT-1)\n\n' +
        '## v1.0.0 (2026-10-13)\n\n- First\n',
    );
    expect(git('log', '-1', '--format=%s')).toBe('Release v1.1.0');
    expect(git('describe', '--exact-match', 'HEAD')).toBe('v1.1.0');
    expect(git('status', '--porcelain')).toBe('');
  });

  it('leaves merge commits out of the changelog', () => {
    git('checkout', '--quiet', '-b', 'side');
    commitFile('a.txt', 'a', 'Add a (PT-1)');
    git('checkout', '--quiet', 'main');
    git('merge', '--quiet', '--no-ff', '-m', "Merge branch 'side'", 'side');
    expect(run().subjects).toEqual(['Add a (PT-1)']);
  });

  it('releases from main only', () => {
    git('checkout', '--quiet', '-b', 'feature');
    commitFile('a.txt', 'a', 'Add a');
    expect(run).toThrow('Release from main, not feature.');
    git('checkout', '--quiet', '--detach');
    expect(run).toThrow('Release from main, not a detached HEAD.');
  });

  it('puts the files back when the commit fails', () => {
    commitFile('a.txt', 'a', 'Add a');
    const before = ['package.json', 'package-lock.json', 'CHANGELOG.md'].map(read);
    const hook = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, '#!/bin/sh\necho "hook says no" >&2\nexit 1\n');
    chmodSync(hook, 0o755);

    expect(run).toThrow(
      /The release commit failed, so the files were put back:[\s\S]*hook says no/,
    );
    expect(['package.json', 'package-lock.json', 'CHANGELOG.md'].map(read)).toEqual(before);
    expect(git('status', '--porcelain')).toBe('');
    expect(git('log', '-1', '--format=%s')).toBe('Add a');
    expect(git('tag', '--list', 'v1.1.0')).toBe('');
  });

  it('refuses with uncommitted changes', () => {
    commitFile('a.txt', 'a', 'Add a');
    writeFileSync(join(dir, 'a.txt'), 'changed');
    expect(run).toThrow('Commit or stash your changes first.');
  });

  it('asks for the current version’s tag when it is missing', () => {
    git('tag', '-d', 'v1.0.0');
    commitFile('a.txt', 'a', 'Add a');
    expect(run).toThrow('There is no tag v1.0.0 for the current version.');
  });

  it('refuses when there is nothing new, or the new tag exists', () => {
    expect(run).toThrow('Nothing was committed since v1.0.0.');
    commitFile('a.txt', 'a', 'Add a');
    git('tag', 'v1.1.0');
    expect(run).toThrow('Tag v1.1.0 already exists.');
    expect(JSON.parse(read('package.json'))).toMatchObject({ version: '1.0.0' });
  });
});
