import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PREFIX = 'tracker-prompt-';
const NAME = 'prompt.sock';
// macOS keeps 104 bytes of a socket's path and binds a longer one cut, outside the 0700 folder:
// that bind fails when something already has the cut path, as a socket a killed helper left
// there. Linux keeps 108.
const PATH_MAX = 100;
const SHORT_BASE = '/tmp';

export interface SocketFolder {
  dir: string;
  path: string;
}

// mkdtemp's six random characters are part of the path, so they are counted before it runs.
function baseFolder(): string {
  const base = tmpdir();
  const longest = join(base, `${PREFIX}XXXXXX`, NAME);
  return Buffer.byteLength(longest) > PATH_MAX ? SHORT_BASE : base;
}

// mkdtemp makes the folder 0700, so only this user can reach the socket in it.
export function makeSocketFolder(): SocketFolder {
  const dir = mkdtempSync(join(baseFolder(), PREFIX));
  return { dir, path: join(dir, NAME) };
}
