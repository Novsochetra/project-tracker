import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bumpVersion, type ReleasePart } from './bump';
import { addToChangelog, changelogEntry } from './changelog';
import { createGit, type Git } from './git';
import { readVersion, setLockVersion, setPackageVersion } from './packageFiles';

export interface ReleaseOptions {
  cwd: string;
  part: ReleasePart;
  day: string;
  git?: Git;
}

export interface Released {
  version: string;
  tag: string;
  subjects: string[];
}

const tagOf = (version: string) => `v${version}`;

export const RELEASE_BRANCH = 'main';

function checkReady(git: Git, current: string, next: string): string[] {
  const branch = git.branch();
  if (branch !== RELEASE_BRANCH) {
    throw new Error(`Release from ${RELEASE_BRANCH}, not ${branch || 'a detached HEAD'}.`);
  }
  if (!git.isClean()) throw new Error('Commit or stash your changes first.');
  const from = tagOf(current);
  if (!git.hasTag(from)) {
    throw new Error(
      `There is no tag ${from} for the current version. Tag the commit that shipped it once ` +
        `(git tag -a ${from} -m "Release ${from}" <commit>), then run this again.`,
    );
  }
  if (git.hasTag(tagOf(next))) throw new Error(`Tag ${tagOf(next)} already exists.`);
  const subjects = git.subjectsSince(from);
  if (subjects.length === 0) throw new Error(`Nothing was committed since ${from}.`);
  return subjects;
}

type Originals = Map<string, string | null>;

function writeFiles(cwd: string, version: string, entry: string): Originals {
  const path = (name: string) => join(cwd, name);
  const read = (name: string) => (existsSync(path(name)) ? readFileSync(path(name), 'utf8') : null);
  const originals: Originals = new Map(
    ['package.json', 'CHANGELOG.md', 'package-lock.json'].map((name) => [name, read(name)]),
  );
  writeFileSync(path('package.json'), setPackageVersion(read('package.json') ?? '{}', version));
  writeFileSync(path('CHANGELOG.md'), addToChangelog(read('CHANGELOG.md'), entry));
  const lock = originals.get('package-lock.json');
  if (lock === null || lock === undefined) originals.delete('package-lock.json');
  else writeFileSync(path('package-lock.json'), setLockVersion(lock, version));
  return originals;
}

function restoreFiles(cwd: string, originals: Originals): void {
  for (const [name, text] of originals) {
    if (text === null) rmSync(join(cwd, name), { force: true });
    else writeFileSync(join(cwd, name), text);
  }
}

// A hook or commit signing can refuse the commit; the release then leaves the tree as it found it.
function commitOrRestore(git: Git, cwd: string, originals: Originals, message: string): void {
  const files = [...originals.keys()];
  try {
    git.commit(files, message);
  } catch (error) {
    git.unstage(files);
    restoreFiles(cwd, originals);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`The release commit failed, so the files were put back:\n${reason}`);
  }
}

// Commits and tags locally only: pushing stays a separate, deliberate step.
export function release({ cwd, part, day, git = createGit(cwd) }: ReleaseOptions): Released {
  const current = readVersion(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const version = bumpVersion(current, part);
  const subjects = checkReady(git, current, version);
  const originals = writeFiles(cwd, version, changelogEntry(version, day, subjects));
  const tag = tagOf(version);
  commitOrRestore(git, cwd, originals, `Release ${tag}`);
  git.tag(tag, `Release ${tag}`);
  return { version, tag, subjects };
}
