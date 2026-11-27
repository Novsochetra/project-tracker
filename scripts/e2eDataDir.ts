import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface DataDirHost {
  env: Record<string, string | undefined>;
  make: () => string;
  onExit: (listener: () => void) => void;
  remove: (dir: string) => void;
  log: (line: string) => void;
}

const NODE_HOST: DataDirHost = {
  env: process.env,
  make: () => mkdtempSync(join(tmpdir(), 'tracker-e2e-')),
  onExit: (listener) => process.once('exit', listener),
  remove: (dir) => rmSync(dir, { recursive: true, force: true }),
  log: (line) => console.error(line),
};

// The folder a run's server keeps its database and uploads in. Workers get it in E2E_DATA_DIR, so
// only the run that made it removes it; a folder someone gave in E2E_DATA_DIR always stays.
export function e2eDataDir(host: DataDirHost = NODE_HOST): string {
  const given = host.env.E2E_DATA_DIR;
  if (given) return given;

  const dir = host.make();
  host.env.E2E_DATA_DIR = dir;
  // Playwright stops its web servers before the process exits, so nothing writes here any more.
  // A failed removal must not throw: it would skip the exit listeners after this one.
  host.onExit(() => {
    if (host.env.E2E_KEEP === '1') {
      host.log(`E2E_KEEP=1: kept the data folder at ${dir}`);
      return;
    }

    try {
      host.remove(dir);
    } catch (error) {
      host.log(`Couldn't remove the data folder ${dir}: ${String(error)}`);
    }
  });

  return dir;
}
