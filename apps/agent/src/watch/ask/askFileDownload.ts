import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebStream } from 'node:stream/web';
import type { Attachment } from '@tracker/shared';
import { describeError } from '../../errors';

export type FetchFile = (
  attachmentId: string,
  options: { signal: AbortSignal },
) => Promise<Response>;

// A stalled download is given up after this long with nothing new, rather than holding the
// question; a slow one that keeps sending goes on, as a 100 MB video may take minutes.
export const DOWNLOAD_STALL_MS = 60_000;

export interface DownloadOptions {
  stop: AbortSignal;
  stallMs?: number | undefined;
}

interface StallGuard {
  signal: AbortSignal;
  alive: () => void;
  end: () => void;
}

function stallGuard(ms: number): StallGuard {
  const stalled = new AbortController();
  const timer = setTimeout(
    () => stalled.abort(new Error(`the tracker sent nothing for ${Math.round(ms / 1000)} s.`)),
    ms,
  );
  return { signal: stalled.signal, alive: () => timer.refresh(), end: () => clearTimeout(timer) };
}

async function fetchTo(fetchFile: FetchFile, file: Attachment, path: string, stall: StallGuard) {
  const { signal } = stall;
  const response = await fetchFile(file.id, { signal });
  if (!response.body) throw new Error('The tracker sent no file.');
  const body = Readable.fromWeb(response.body as WebStream<Uint8Array>);
  body.on('data', stall.alive);
  // 'wx': the folder is new and private, and a file is never written over or through a link.
  const out = createWriteStream(path, { flags: 'wx', mode: 0o600 });
  await pipeline(body, out, { signal });
}

export async function downloadFile(
  fetchFile: FetchFile,
  file: Attachment,
  path: string,
  { stop, stallMs = DOWNLOAD_STALL_MS }: DownloadOptions,
): Promise<void> {
  const stall = stallGuard(stallMs);
  const signal = AbortSignal.any([stop, stall.signal]);
  try {
    await fetchTo(fetchFile, file, path, { ...stall, signal });
  } catch (error) {
    // A stop ends the run as cancelled (runLoop), so its error needs no words.
    if (stop.aborted) throw error;
    const why: unknown = stall.signal.aborted ? stall.signal.reason : error;
    throw new Error(`Couldn't get ${file.fileName} from the tracker: ${describeError(why)}`);
  } finally {
    stall.end();
  }
}
