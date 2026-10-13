import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Attachment, RunJob } from '@tracker/shared';
import { downloadFile, type DownloadOptions, type FetchFile } from './askFileDownload';
import { localNames } from './askFileNames';

export type { FetchFile } from './askFileDownload';

export interface AskFolder {
  dir: string;
  paths: string[];
}

export const ASK_FOLDER_PREFIX = 'tracker-ask-';

async function downloadAll(
  fetchFile: FetchFile,
  files: readonly Attachment[],
  dir: string,
  options: DownloadOptions,
) {
  const names = localNames(files.map((file) => file.fileName));
  const paths: string[] = [];
  for (const [index, file] of files.entries()) {
    options.stop.throwIfAborted();
    const path = join(dir, names[index] ?? `file-${index + 1}`);
    await downloadFile(fetchFile, file, path, options);
    paths.push(path);
  }
  return paths;
}

// The question's files go to a folder of this run's own, which goes when the run ends however it
// ends: answered, failed, stopped or a download that failed.
export async function withAskFiles<T>(
  fetchFile: FetchFile | undefined,
  { job, ...options }: DownloadOptions & { job: Pick<RunJob, 'files'> },
  work: (folder: AskFolder | null) => Promise<T>,
): Promise<T> {
  const files = job.files ?? [];
  if (files.length === 0) return work(null);
  if (!fetchFile) throw new Error("This helper can't download the question's files.");
  const dir = await mkdtemp(join(tmpdir(), ASK_FOLDER_PREFIX));
  try {
    const paths = await downloadAll(fetchFile, files, dir, options);
    return await work({ dir, paths });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Claude Code's file tools reach only its working folders, so the question's folder is added.
// In Ask and Plan the read-only flags still hold there: Claude can read the files, not change them.
export const addDirArgs = (folder: AskFolder | null): string[] =>
  folder ? ['--add-dir', folder.dir] : [];
