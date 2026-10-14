import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gitOutput, type GitOptions } from './gitOutput';

const SMALL = 4_000;

async function gitLine(
  cwd: string,
  args: readonly string[],
  options: Omit<GitOptions, 'maxChars'>,
) {
  const { text, code } = await gitOutput(cwd, args, { maxChars: SMALL, ...options });
  const value = text.trim();
  return code === 0 && value ? value : null;
}

// The folder's files as git would commit them now, untracked ones too and ignored ones not, as a
// tree. It goes through an index file of its own, so the real index, which the person or Claude
// may be using, is never written; git only adds the files' objects. Null outside a repository.
export async function snapshotTree(cwd: string, signal: AbortSignal): Promise<string | null> {
  const realIndex = await gitLine(cwd, ['rev-parse', '--git-path', 'index'], { signal });
  if (!realIndex) return null;
  const folder = await mkdtemp(join(tmpdir(), 'tracker-index-'));
  const env = { GIT_INDEX_FILE: join(folder, 'index') };
  try {
    // From a copy of the real index git skips the files whose stat hasn't changed; a repository
    // with no commit yet has none. The copy keeps the index's time, by which git tells a file
    // changed in the same second as the index was written (racy git) and reads it again.
    await cp(resolve(cwd, realIndex), env.GIT_INDEX_FILE, { preserveTimestamps: true }).catch(
      () => undefined,
    );
    const added = await gitOutput(cwd, ['add', '-A', '--', '.'], { maxChars: SMALL, signal, env });
    if (added.code !== 0) return null;
    return await gitLine(cwd, ['write-tree'], { signal, env });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
