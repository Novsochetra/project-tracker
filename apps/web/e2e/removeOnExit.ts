import { rmSync } from 'node:fs';

// Playwright stops its web servers before the process exits, so nothing writes to the folder any
// more when it is removed.
export function removeOnExit(dir: string, keep: boolean): void {
  process.once('exit', () => {
    if (keep) {
      console.error(`E2E_KEEP=1: kept the data folder at ${dir}`);
      return;
    }

    rmSync(dir, { recursive: true, force: true });
  });
}
