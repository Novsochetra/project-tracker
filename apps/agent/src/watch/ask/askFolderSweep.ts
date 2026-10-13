import { lstat, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ASK_FOLDER_PREFIX } from './askFiles';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SweepOptions {
  root?: string;
  now?: number;
  maxAgeMs?: number;
}

// A helper killed mid-question (SIGKILL, a crash, a power cut) never removes that run's folder.
// A day is far past any question, so a folder that old belongs to no running run.
async function isStale(path: string, before: number): Promise<boolean> {
  const info = await lstat(path).catch(() => null);
  const ours = info !== null && info.uid === process.getuid?.();
  return ours && info.isDirectory() && info.mtimeMs < before;
}

export async function sweepAskFolders({
  root = tmpdir(),
  now = Date.now(),
  maxAgeMs = DAY_MS,
}: SweepOptions = {}): Promise<string[]> {
  const names = await readdir(root).catch(() => []);
  const removed: string[] = [];
  for (const name of names.filter((entry) => entry.startsWith(ASK_FOLDER_PREFIX))) {
    const path = join(root, name);
    if (!(await isStale(path, now - maxAgeMs))) continue;
    await rm(path, { recursive: true, force: true }).then(
      () => removed.push(path),
      () => undefined,
    );
  }
  return removed;
}
