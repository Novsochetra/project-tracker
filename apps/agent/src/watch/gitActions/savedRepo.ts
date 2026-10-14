import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runTool } from '../git/runTool';
import type { StepContext } from './gitStep';

export interface SavedRepo {
  index: string;
  copy: string | null;
  folder: string;
  branch: string | null;
  head: string | null;
}

// The restore runs after a deadline too, so it gets a short one of its own.
const RESTORE_MS = 15_000;

async function out(cwd: string, args: readonly string[], signal: AbortSignal) {
  const { code, out: text } = await runTool('git', args, { cwd, signal });
  return code === 0 && text.trim() ? text.trim() : null;
}

// The real index and the checked-out branch, so a commit that fails leaves both as they were.
export async function saveRepo({ cwd, signal }: StepContext): Promise<SavedRepo> {
  const index = resolve(cwd, (await out(cwd, ['rev-parse', '--git-path', 'index'], signal)) ?? '');
  const folder = await mkdtemp(join(tmpdir(), 'tracker-commit-'));
  const copy = join(folder, 'index');
  // The copy keeps the index's time, as in snapshot.ts, so git's racy-file checks still hold.
  const saved = await cp(index, copy, { preserveTimestamps: true }).then(
    () => copy,
    () => null,
  );
  const branch = await out(cwd, ['branch', '--show-current'], signal);
  const head = await out(cwd, ['rev-parse', '--verify', '-q', 'HEAD'], signal);
  return { index, copy: saved, folder, branch, head };
}

async function leaveNewBranch(cwd: string, saved: SavedRepo, created: string, signal: AbortSignal) {
  if ((await out(cwd, ['branch', '--show-current'], signal)) !== created) return;
  const back = saved.branch ? ['switch', saved.branch] : ['switch', '--detach', saved.head ?? ''];
  await runTool('git', back, { cwd, signal });
  // Only a branch with no commit of its own goes; one that holds work stays.
  const tip = await out(cwd, ['rev-parse', '--verify', '-q', `refs/heads/${created}`], signal);
  if (tip && tip === saved.head) await runTool('git', ['branch', '-D', created], { cwd, signal });
}

export async function restoreRepo(cwd: string, saved: SavedRepo, created: string | null) {
  const signal = AbortSignal.timeout(RESTORE_MS);
  try {
    if (created) await leaveNewBranch(cwd, saved, created, signal);
    if (saved.copy) await cp(saved.copy, saved.index, { preserveTimestamps: true });
    else await rm(saved.index, { force: true });
  } catch {
    // Best effort: the failure the person sees is the commit's.
  }
}

export const forgetRepo = (saved: SavedRepo) => rm(saved.folder, { recursive: true, force: true });
