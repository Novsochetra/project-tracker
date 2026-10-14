import { realpath } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, parse, relative, resolve, sep } from 'node:path';

// Text in a ticket can ask Claude to attach any file, so only what it made for the work, here or
// in a temp folder, may leave this computer: never ~/.ssh. /tmp too, since on a Mac it isn't
// tmpdir() and Claude Code keeps its scratch files there.
const tempFolders = (): string[] => [tmpdir(), '/tmp'];

export const attachFolders = (cwd = process.cwd()): string[] => [cwd, ...tempFolders()];

// Ask and Plan pass the project folder alone, so a refusal must not offer a temp folder.
const takesTemp = (folders: readonly string[]): boolean =>
  folders.some((folder) => tempFolders().includes(folder));

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

// Run from ~/.claude or ~/.aws, every file there is a key or a setting, whatever its name.
const inHomeDotFolder = (folder: string, home: string): boolean =>
  isInside(home, folder) && relative(home, folder).startsWith('.');

const unsafe = (folder: string, home: string): boolean =>
  holdsHome(folder, home) || inHomeDotFolder(folder, home);

const outsideError = (path: string, folders: readonly string[]): Error =>
  new Error(
    `Can't attach ${path}: only files in ${takesTemp(folders) ? 'this folder or a temp folder' : 'this folder'} ` +
      `can be attached (${folders.join(', ')}).`,
  );

const onlyTemp = (temp: boolean) =>
  temp ? 'only files in a temp folder can be attached' : 'no file can be attached';

const homeError = (path: string, folder: string, temp: boolean): Error =>
  new Error(
    `Can't attach ${path}: Claude Code runs in ${folder}, which holds your home folder, so ` +
      `${onlyTemp(temp)}. Start it in a project folder instead.`,
  );

const dotFolderError = (path: string): Error =>
  new Error(
    `Can't attach ${path}: it is in a folder whose name starts with a dot, where keys and ` +
      'settings are kept.',
  );

const homeDotFolderError = (path: string, folder: string, temp: boolean): Error =>
  new Error(
    `Can't attach ${path}: Claude Code runs in ${folder}, a dot-folder of your home folder where ` +
      `keys and settings are kept, so ${onlyTemp(temp)}. Start it in a project folder instead.`,
  );

const unsafeError = (path: string, folder: string, home: string, temp: boolean): Error =>
  holdsHome(folder, home) ? homeError(path, folder, temp) : homeDotFolderError(path, folder, temp);

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
  const safe = holding.filter((folder) => !unsafe(folder, realHome));
  if (safe.length === 0) throw unsafeError(path, holding[0] ?? '', realHome, takesTemp(folders));
  if (safe.some((folder) => !inDotFolder(folder, real))) return real;
  throw dotFolderError(path);
}
