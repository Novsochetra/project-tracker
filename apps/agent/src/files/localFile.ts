import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { checkAttachment, type AttachmentMimeType } from '@tracker/shared';
import { allowedRealPath } from './allowedPath';

export interface LocalFile {
  realPath: string;
  name: string;
  mimeType: AttachmentMimeType;
  size: number;
}

export async function checkLocalFile(path: string, folders: readonly string[]): Promise<LocalFile> {
  const realPath = await allowedRealPath(path, folders);
  const info = await stat(realPath);
  if (!info.isFile()) throw new Error(`Can't attach ${path}: it is not a file.`);
  const name = basename(path);
  const check = checkAttachment({ type: '', name, size: info.size });
  if (!check.ok) throw new Error(`Can't attach ${name}. ${check.message}`);
  return { realPath, name, mimeType: check.mimeType, size: info.size };
}

export const readLocalFile = async (file: LocalFile): Promise<Blob> =>
  new Blob([await readFile(file.realPath)], { type: file.mimeType });
