import { LIVE_STALE_MS, type ChatGitEvent, type RunEvent } from '@tracker/shared';
import { retryDelay } from './retry';
import { wait } from './wait';
import { createSseParser } from './sse';

export interface LiveStreamOptions {
  url: string;
  token: string | undefined;
  signal: AbortSignal;
  onOpen: () => void;
  onRun: (event: RunEvent) => void;
  onGit?: ((event: ChatGitEvent) => void) | undefined;
  staleMs?: number;
}

function parseEvent<T extends { type: string }>(data: string, type: T['type']): T | null {
  try {
    const event = JSON.parse(data) as T;
    return event.type === type ? event : null;
  } catch {
    return null;
  }
}

function readMessage(event: string, data: string, options: LiveStreamOptions) {
  const run = event === 'run' ? parseEvent<RunEvent>(data, 'run') : null;
  if (run) options.onRun(run);
  const git = event === 'chat-git' ? parseEvent<ChatGitEvent>(data, 'chat-git') : null;
  if (git) options.onGit?.(git);
}

// A proxy can keep a dead stream open, so silence past two pings counts as a drop.
async function readUntilDropped(response: Response, options: LiveStreamOptions): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const feed = createSseParser(({ event, data }) => readMessage(event, data, options));
  let silence: NodeJS.Timeout | undefined;
  const alive = () => {
    clearTimeout(silence);
    silence = setTimeout(() => void reader.cancel(), options.staleMs ?? LIVE_STALE_MS);
  };
  try {
    alive();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      alive();
      feed(decoder.decode(chunk.value, { stream: true }));
    }
  } finally {
    clearTimeout(silence);
  }
}

async function connectOnce(options: LiveStreamOptions): Promise<void> {
  const headers: Record<string, string> = { accept: 'text/event-stream' };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(options.url, { headers, signal: options.signal });
  if (!response.ok || !response.body) throw new Error(`the tracker answered ${response.status}`);
  options.onOpen();
  await readUntilDropped(response, options);
}

export async function followRunEvents(options: LiveStreamOptions): Promise<void> {
  let attempt = 0;
  while (!options.signal.aborted) {
    const opened = Date.now();
    // Check-ins every 20 s report a tracker that can't be reached; the stream only speeds up runs.
    await connectOnce(options).catch(() => undefined);
    if (Date.now() - opened > (options.staleMs ?? LIVE_STALE_MS)) attempt = 0;
    await wait(retryDelay(attempt), options.signal);
    attempt += 1;
  }
}
