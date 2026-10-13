import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

function checkReady(git: Git, current: string, next: string): string[] {
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

function writeFiles(cwd: string, version: string, entry: string): string[] {
  const path = (name: string) => join(cwd, name);
  const read = (name: string) => (existsSync(path(name)) ? readFileSync(path(name), 'utf8') : null);
  const files = ['package.json', 'CHANGELOG.md'];
  writeFileSync(path('package.json'), setPackageVersion(read('package.json') ?? '{}', version));
  writeFileSync(path('CHANGELOG.md'), addToChangelog(read('CHANGELOG.md'), entry));
  const lock = read('package-lock.json');
  if (lock !== null) {
    writeFileSync(path('package-lock.json'), setLockVersion(lock, version));
    files.push('package-lock.json');
  }
  return files;
}

// Commits and tags locally only: pushing stays a separate, deliberate step.
export function release({ cwd, part, day, git = createGit(cwd) }: ReleaseOptions): Released {
  const current = readVersion(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const version = bumpVersion(current, part);
  const subjects = checkReady(git, current, version);
  const files = writeFiles(cwd, version, changelogEntry(version, day, subjects));
  const tag = tagOf(version);
  git.commit(files, `Release ${tag}`);
  git.tag(tag, `Release ${tag}`);
  return { version, tag, subjects };
}
