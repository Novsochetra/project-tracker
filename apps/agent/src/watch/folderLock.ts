import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';

export class FolderBusyError extends Error {
  override name = 'FolderBusyError';
}

const codeOf = (error: unknown): unknown => (error as NodeJS.ErrnoException).code;

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return codeOf(error) === 'EPERM';
  }
}

function tryCreate(path: string): boolean {
  try {
    const file = openSync(path, 'wx', 0o600);
    writeSync(file, String(process.pid));
    closeSync(file);
    return true;
  } catch (error) {
    if (codeOf(error) === 'EEXIST') return false;
    throw error;
  }
}

function holderOf(path: string): number | undefined {
  try {
    const pid = Number(readFileSync(path, 'utf8'));
    return Number.isInteger(pid) && pid > 0 && isRunning(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

// Two helpers in one folder would run two Claudes in one working tree, and with one id they end
// each other's runs.
export function lockFolder(lockFolderPath: string, folder: string): () => void {
  mkdirSync(lockFolderPath, { recursive: true, mode: 0o700 });
  const name = createHash('sha256').update(folder).digest('hex').slice(0, 16);
  const path = join(lockFolderPath, `watch-${name}.lock`);
  if (!tryCreate(path)) {
    const holder = holderOf(path);
    if (holder !== undefined) {
      throw new FolderBusyError(
        `tracker watch already runs in this folder (process ${holder}). If it doesn't, delete ${path}.`,
      );
    }
    rmSync(path, { force: true });
    if (!tryCreate(path)) throw new FolderBusyError('tracker watch just started in this folder.');
  }
  return () => rmSync(path, { force: true });
}
