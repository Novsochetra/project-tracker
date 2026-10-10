import { LIVE_STALE_MS, type RunEvent } from '@tracker/shared';
import { retryDelay, wait } from './retryDelay';
import { createSseParser } from './sse';

export interface LiveStreamOptions {
  url: string;
  token: string | undefined;
  signal: AbortSignal;
  onOpen: () => void;
  onRun: (event: RunEvent) => void;
  onDrop: (reason: string) => void;
  staleMs?: number;
}

function parseRunEvent(data: string): RunEvent | null {
  try {
    const event = JSON.parse(data) as RunEvent;
    return event.type === 'run' ? event : null;
  } catch {
    return null;
  }
}

// A proxy can keep a dead stream open, so silence past two pings counts as a drop.
async function readUntilDropped(response: Response, options: LiveStreamOptions): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const feed = createSseParser(({ event, data }) => {
    const run = event === 'run' ? parseRunEvent(data) : null;
    if (run) options.onRun(run);
  });
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
  const response = await fetch(`${options.url}/api/events`, { headers, signal: options.signal });
  if (!response.ok || !response.body) throw new Error(`the tracker answered ${response.status}`);
  options.onOpen();
  await readUntilDropped(response, options);
}

export async function followRunEvents(options: LiveStreamOptions): Promise<void> {
  let attempt = 0;
  while (!options.signal.aborted) {
    const opened = Date.now();
    try {
      await connectOnce(options);
    } catch (error) {
      if (options.signal.aborted) return;
      options.onDrop(error instanceof Error ? error.message : String(error));
    }
    if (Date.now() - opened > (options.staleMs ?? LIVE_STALE_MS)) attempt = 0;
    await wait(retryDelay(attempt), options.signal);
    attempt += 1;
  }
}
