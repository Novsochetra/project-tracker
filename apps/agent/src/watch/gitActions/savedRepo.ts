import { cp, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CHAT_FILES_MAX, DIFF_PATH_MAX } from '@tracker/shared';
import { runTool, type ToolStopped } from '../git/runTool';
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
// Every picked path's index entry, whole: a cut one would be written back wrong.
const ENTRIES_MAX = CHAT_FILES_MAX * 4 * (DIFF_PATH_MAX + 100);

async function out(cwd: string, args: readonly string[], signal: AbortSignal) {
  const { code, out: text } = await runTool('git', args, { cwd, signal });
  return code === 0 && text.trim() ? text.trim() : null;
}

const lockOf = (saved: Pick<SavedRepo, 'index'>) => `${saved.index}.lock`;

// The picked files' index entries and the checked-out branch, so a commit that fails leaves
// both as they were.
export async function saveRepo({ cwd, signal }: StepContext): Promise<SavedRepo> {
  const index = resolve(cwd, (await out(cwd, ['rev-parse', '--git-path', 'index'], signal)) ?? '');
  const folder = await mkdtemp(join(tmpdir(), 'tracker-commit-'));
  const copy = join(folder, 'index');
  const saved = await cp(index, copy).then(
    () => copy,
    () => null,
  );
  const branch = await out(cwd, ['branch', '--show-current'], signal);
  const head = await out(cwd, ['rev-parse', '--verify', '-q', 'HEAD'], signal);
  return { index, copy: saved, folder, branch, head };
}

export const GIT_BUSY = 'Nothing was committed, but git is busy in this folder. Try again.';

// Returns false when git can't switch back, as when another git holds the index.
async function leaveNewBranch(cwd: string, saved: SavedRepo, created: string, signal: AbortSignal) {
  if ((await out(cwd, ['branch', '--show-current'], signal)) !== created) return true;
  const back = saved.branch ? ['switch', saved.branch] : ['switch', '--detach', saved.head ?? ''];
  if ((await runTool('git', back, { cwd, signal })).code !== 0) return false;
  // Only a branch with no commit of its own goes; one that holds work stays.
  const tip = await out(cwd, ['rev-parse', '--verify', '-q', `refs/heads/${created}`], signal);
  if (tip && tip === saved.head) await runTool('git', ['branch', '-D', created], { cwd, signal });
  return true;
}

const pathOf = (entry: string) => entry.slice(entry.indexOf('\t') + 1);

// Only the picked paths go back to their saved entries, so what the person staged meanwhile in
// other files stays staged.
async function restoreEntries(
  cwd: string,
  saved: SavedRepo,
  paths: readonly string[],
  signal: AbortSignal,
) {
  const listed = saved.copy
    ? await runTool('git', ['ls-files', '-s', '-z', '--', ...paths], {
        cwd,
        signal,
        env: { GIT_INDEX_FILE: saved.copy },
        outMax: ENTRIES_MAX,
      })
    : null;
  const entries = listed?.code === 0 ? listed.out : '';
  const kept = new Set(entries.split('\0').filter(Boolean).map(pathOf));
  const added = paths.filter((path) => !kept.has(path));
  const removed = added.length
    ? await runTool('git', ['update-index', '--force-remove', '--', ...added], { cwd, signal })
    : null;
  const written = entries
    ? await runTool('git', ['update-index', '-z', '--index-info'], { cwd, signal, input: entries })
    : null;
  return (removed?.code ?? 0) === 0 && (written?.code ?? 0) === 0;
}

// Git removes its own lock on SIGTERM, so only one our git held when it got SIGKILL is left by
// us: made after that git started and before the kill. Any other lock is another git's.
async function removeOurLock(saved: SavedRepo, stopped: ToolStopped | null) {
  if (!stopped?.killedAt) return;
  const made = await stat(lockOf(saved)).then(
    (lock) => lock.mtimeMs,
    () => null,
  );
  if (made !== null && made >= stopped.startedAt - 1 && made <= stopped.killedAt) {
    await rm(lockOf(saved), { force: true });
  }
}

export interface FailedChange {
  created: string | null;
  paths: readonly string[];
  // The git call the deadline stopped, if that is how the commit failed.
  stopped: ToolStopped | null;
}

// True when the branch and the picked files' entries are back as they were.
export async function restoreRepo(cwd: string, saved: SavedRepo, change: FailedChange) {
  const signal = AbortSignal.timeout(RESTORE_MS);
  try {
    await removeOurLock(saved, change.stopped);
    const back = change.created ? await leaveNewBranch(cwd, saved, change.created, signal) : true;
    return back && (await restoreEntries(cwd, saved, change.paths, signal));
  } catch {
    return false;
  }
}

export const forgetRepo = (saved: SavedRepo) => rm(saved.folder, { recursive: true, force: true });
