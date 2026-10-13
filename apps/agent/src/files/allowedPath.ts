import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// Text in a ticket can ask Claude to attach any file, so only what it made for the work, here or
// in a temp folder, may leave this computer: never ~/.ssh. /tmp too, since on a Mac it isn't
// tmpdir() and Claude Code keeps its scratch files there.
export const attachFolders = (): string[] => [process.cwd(), tmpdir(), '/tmp'];

const realOrNull = (path: string): Promise<string | null> => realpath(path).catch(() => null);

const isInside = (folder: string, file: string): boolean => {
  const path = relative(folder, file);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

// Real paths on both sides: a symlink in the folder may point anywhere.
export async function allowedRealPath(path: string, folders: readonly string[]): Promise<string> {
  const real = await realOrNull(resolve(path));
  if (!real) throw new Error(`There is no file at ${path}.`);
  const realFolders = await Promise.all(folders.map(realOrNull));
  if (realFolders.some((folder) => folder !== null && isInside(folder, real))) return real;
  throw new Error(
    `Can't attach ${path}: only files in this folder or a temp folder can be attached ` +
      `(${folders.join(', ')}).`,
  );
}
