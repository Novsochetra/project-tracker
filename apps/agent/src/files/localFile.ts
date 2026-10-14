import { constants } from 'node:fs';
import { open, realpath, stat, type FileHandle } from 'node:fs/promises';
import { basename } from 'node:path';
import { checkAttachment, type AttachmentMimeType } from '@tracker/shared';
import { allowedRealPath } from './allowedPath';

export interface LocalFile {
  realPath: string;
  name: string;
  mimeType: AttachmentMimeType;
  size: number;
  handle: FileHandle;
}

// No following a symlink put in place after the check, and no hanging on a named pipe.
const OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

const changedError = (path: string): Error =>
  new Error(`Can't attach ${path}: it changed while it was being checked.`);

const CHANGED_CODES = new Set(['ELOOP', 'ENOENT']);

async function isSameFile(handle: FileHandle, realPath: string): Promise<boolean> {
  const [opened, now, real] = await Promise.all([
    handle.stat(),
    stat(realPath).catch(() => null),
    realpath(realPath).catch(() => null),
  ]);
  return real === realPath && now !== null && opened.dev === now.dev && opened.ino === now.ino;
}

// The file is read later through this handle, after earlier files are uploaded, so it must be
// the very file that was checked: a folder on its path could have been swapped meanwhile.
async function openChecked(path: string, realPath: string): Promise<FileHandle> {
  const handle = await open(realPath, OPEN_FLAGS).catch((error: NodeJS.ErrnoException) => {
    throw CHANGED_CODES.has(error.code ?? '') ? changedError(path) : error;
  });
  try {
    if (await isSameFile(handle, realPath)) return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
  await handle.close();
  throw changedError(path);
}

// The name and type come from the real file: a symlink named x.txt must not send ~/.aws/credentials.
async function measure(path: string, realPath: string, handle: FileHandle) {
  const info = await handle.stat();
  if (!info.isFile()) throw new Error(`Can't attach ${path}: it is not a file.`);
  const name = basename(realPath);
  const check = checkAttachment({ type: '', name, size: info.size });
  if (!check.ok) throw new Error(`Can't attach ${name}. ${check.message}`);
  return { name, mimeType: check.mimeType, size: info.size };
}

export async function checkLocalFile(path: string, folders: readonly string[]): Promise<LocalFile> {
  const realPath = await allowedRealPath(path, folders);
  const handle = await openChecked(path, realPath);
  try {
    return { realPath, handle, ...(await measure(path, realPath, handle)) };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

// Only the bytes the check measured, so a file that grew since can't pass the size limit.
export async function readLocalBytes(file: LocalFile): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new Uint8Array(file.size);
  let filled = 0;
  while (filled < file.size) {
    const { bytesRead } = await file.handle.read(bytes, filled, file.size - filled, filled);
    if (bytesRead === 0) break;
    filled += bytesRead;
  }
  return bytes.subarray(0, filled);
}

export const readLocalFile = async (file: LocalFile): Promise<Blob> =>
  new Blob([await readLocalBytes(file)], { type: file.mimeType });

export const closeLocalFiles = async (files: readonly LocalFile[]): Promise<void> => {
  await Promise.all(files.map((file) => file.handle.close()));
};
