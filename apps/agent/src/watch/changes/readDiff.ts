import { RUN_DIFF_MAX } from '@tracker/shared';
import { gitOutput } from './gitOutput';

export interface RawDiff {
  raw: string;
  cut: boolean;
}

// Whatever the person's git config says, so the tracker can read it: no colors, no external or
// converting diff tools, a/ and b/ before paths, and paths as they are.
const DIFF = [
  '-c',
  'core.quotePath=false',
  'diff',
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--src-prefix=a/',
  '--dst-prefix=b/',
];
// Masking reads twice the cap at most (prepareDiff), so more is never held.
const ROOM = RUN_DIFF_MAX * 2;
const UNTRACKED_MAX = 100;

// Files Claude made and didn't commit or add are in no `git diff`, so each is diffed as new.
async function untrackedFiles(cwd: string): Promise<{ paths: string[]; cut: boolean }> {
  const list = await gitOutput(cwd, ['ls-files', '--others', '--exclude-standard', '-z'], ROOM);
  const paths = list.text.split('\0').filter(Boolean);
  if (list.cut) paths.pop();
  return { paths: paths.slice(0, UNTRACKED_MAX), cut: list.cut || paths.length > UNTRACKED_MAX };
}

async function newFileDiff(cwd: string, path: string, room: number) {
  return gitOutput(cwd, [...DIFF, '--no-index', '--', '/dev/null', path], room);
}

// The folder's files now, committed or not, against the base commit.
export async function readDiff(cwd: string, base: string): Promise<RawDiff> {
  const tracked = await gitOutput(cwd, [...DIFF, base, '--'], ROOM);
  if (tracked.code !== 0) throw new Error(`git diff exited with ${tracked.code}.`);
  if (tracked.cut) return { raw: tracked.text, cut: true };
  const untracked = await untrackedFiles(cwd);
  let raw = tracked.text;
  for (const path of untracked.paths) {
    if (raw.length >= ROOM) return { raw, cut: true };
    const added = await newFileDiff(cwd, path, ROOM - raw.length);
    raw += added.text;
    if (added.cut) return { raw, cut: true };
  }
  return { raw, cut: untracked.cut };
}
