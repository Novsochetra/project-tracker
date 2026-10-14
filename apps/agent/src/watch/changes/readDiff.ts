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

export async function readDiff(
  cwd: string,
  trees: { from: string; to: string },
  signal: AbortSignal,
): Promise<RawDiff> {
  const diff = await gitOutput(cwd, [...DIFF, trees.from, trees.to, '--'], {
    maxChars: ROOM,
    signal,
  });
  if (diff.code !== 0) throw new Error(`git diff exited with ${diff.code}.`);
  return { raw: diff.text, cut: diff.cut };
}
