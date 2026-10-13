import { realpath } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, isAbsolute, parse, relative, resolve, sep } from 'node:path';

// Text in a ticket can ask Claude to attach any file, so only what it made for the work, here or
// in a temp folder, may leave this computer: never ~/.ssh. /tmp too, since on a Mac it isn't
// tmpdir() and Claude Code keeps its scratch files there.
export const attachFolders = (): string[] => [process.cwd(), tmpdir(), '/tmp'];

const realOrNull = (path: string): Promise<string | null> => realpath(path).catch(() => null);

const isInside = (folder: string, file: string): boolean => {
  const path = relative(folder, file);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

// Claude Code started in the home folder or above it would make ~/.docker/config.json or
// ~/.claude.json "a file in the current folder".
const holdsHome = (folder: string, home: string): boolean =>
  folder === home || folder === parse(folder).root || isInside(folder, home);

// Dot-folders hold keys and settings (.ssh, .aws, .config); one the folder itself is in is fine.
const inDotFolder = (folder: string, file: string): boolean =>
  relative(folder, file)
    .split(sep)
    .slice(0, -1)
    .some((part) => part.startsWith('.'));

// Run from ~/.claude or ~/.aws, its own dot-files are keys and tokens (~/.claude/.credentials.json).
const inHomeDotFolder = (folder: string, home: string): boolean =>
  isInside(home, folder) && relative(home, folder).startsWith('.');

const takes = (folder: string, file: string, home: string): boolean =>
  !inDotFolder(folder, file) && !(basename(file).startsWith('.') && inHomeDotFolder(folder, home));

const outsideError = (path: string, folders: readonly string[]): Error =>
  new Error(
    `Can't attach ${path}: only files in this folder or a temp folder can be attached ` +
      `(${folders.join(', ')}).`,
  );

const homeError = (path: string, folder: string): Error =>
  new Error(
    `Can't attach ${path}: Claude Code runs in ${folder}, which holds your home folder, so only ` +
      'files in a temp folder can be attached. Start it in a project folder instead.',
  );

const dotFolderError = (path: string): Error =>
  new Error(
    `Can't attach ${path}: it is in a folder whose name starts with a dot, where keys and ` +
      'settings are kept.',
  );

const homeDotFileError = (path: string, folder: string): Error =>
  new Error(
    `Can't attach ${path}: its name starts with a dot and Claude Code runs in ${folder}, a ` +
      'dot-folder of your home folder, where keys and settings are kept.',
  );

async function realFolders(folders: readonly string[]): Promise<string[]> {
  const reals = await Promise.all(folders.map(realOrNull));
  return reals.filter((folder): folder is string => folder !== null);
}

// Real paths on both sides: a symlink in the folder may point anywhere.
export async function allowedRealPath(
  path: string,
  folders: readonly string[],
  home: string = homedir(),
): Promise<string> {
  const real = await realOrNull(resolve(path));
  if (!real) throw new Error(`There is no file at ${path}.`);
  const holding = (await realFolders(folders)).filter((folder) => isInside(folder, real));
  if (holding.length === 0) throw outsideError(path, folders);
  const realHome = (await realOrNull(home)) ?? resolve(home);
  const safe = holding.filter((folder) => !holdsHome(folder, realHome));
  if (safe.length === 0) throw homeError(path, holding[0] ?? '');
  if (safe.some((folder) => takes(folder, real, realHome))) return real;
  const outOfDotFolders = safe.find((folder) => !inDotFolder(folder, real));
  throw outOfDotFolders ? homeDotFileError(path, outOfDotFolders) : dotFolderError(path);
}
