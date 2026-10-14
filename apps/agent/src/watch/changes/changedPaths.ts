import { CHAT_FILES_MAX, DIFF_PATH_MAX } from '@tracker/shared';
import { gitOutput } from './gitOutput';

export interface ChangedPaths {
  paths: string[];
  cut: boolean;
}

const ROOM = CHAT_FILES_MAX * 4 * (DIFF_PATH_MAX + 1);

// NUL-separated, so a path with a newline or a quote reads as it is; a delete and an add, never a
// rename, so both a rename's paths are the change's.
export async function changedPaths(
  cwd: string,
  trees: { from: string; to: string; paths?: readonly string[] },
  signal: AbortSignal,
): Promise<ChangedPaths> {
  const pathspec = trees.paths ? ['--', ...trees.paths] : ['--'];
  const args = ['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', trees.from, trees.to];
  const { text, code, cut } = await gitOutput(cwd, [...args, ...pathspec], {
    maxChars: ROOM,
    signal,
    env: { GIT_LITERAL_PATHSPECS: '1' },
  });
  if (code !== 0) throw new Error(`git diff exited with ${code}.`);
  const parts = text.split('\0');
  // The last part is empty after the last NUL, or a path cut short.
  parts.pop();
  return { paths: parts.filter(Boolean), cut };
}
