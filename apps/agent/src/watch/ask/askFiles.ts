import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebStream } from 'node:stream/web';
import type { Attachment, RunJob } from '@tracker/shared';
import { describeError } from '../../errors';
import { localNames } from './askFileNames';

export type FetchFile = (attachmentId: string) => Promise<Response>;

export interface AskFolder {
  dir: string;
  paths: string[];
}

export const ASK_FOLDER_PREFIX = 'tracker-ask-';

async function download(fetchFile: FetchFile, file: Attachment, path: string): Promise<void> {
  try {
    const response = await fetchFile(file.id);
    if (!response.body) throw new Error('The tracker sent no file.');
    // 'wx': the folder is new and private, and a file is never written over or through a link.
    const out = createWriteStream(path, { flags: 'wx', mode: 0o600 });
    await pipeline(Readable.fromWeb(response.body as WebStream<Uint8Array>), out);
  } catch (error) {
    throw new Error(`Couldn't get ${file.fileName} from the tracker: ${describeError(error)}`);
  }
}

async function downloadAll(
  fetchFile: FetchFile,
  files: readonly Attachment[],
  dir: string,
  stop: AbortSignal,
) {
  const names = localNames(files.map((file) => file.fileName));
  const paths: string[] = [];
  for (const [index, file] of files.entries()) {
    stop.throwIfAborted();
    const path = join(dir, names[index] ?? `file-${index + 1}`);
    await download(fetchFile, file, path);
    paths.push(path);
  }
  return paths;
}

// The question's files go to a folder of this run's own, which goes when the run ends however it
// ends: answered, failed, stopped or a download that failed.
export async function withAskFiles<T>(
  fetchFile: FetchFile | undefined,
  { job, stop }: { job: Pick<RunJob, 'files'>; stop: AbortSignal },
  work: (folder: AskFolder | null) => Promise<T>,
): Promise<T> {
  const files = job.files ?? [];
  if (files.length === 0) return work(null);
  if (!fetchFile) throw new Error("This helper can't download the question's files.");
  const dir = await mkdtemp(join(tmpdir(), ASK_FOLDER_PREFIX));
  try {
    const paths = await downloadAll(fetchFile, files, dir, stop);
    return await work({ dir, paths });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Claude Code's file tools reach only its working folders, so the question's folder is added.
// In Ask and Plan the read-only flags still hold there: Claude can read the files, not change them.
export const addDirArgs = (folder: AskFolder | null): string[] =>
  folder ? ['--add-dir', folder.dir] : [];
