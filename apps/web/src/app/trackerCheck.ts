import type { TrackerClient } from '@tracker/client';
import { signalOfError, type ApiSignal } from './offline';

// A read that only the tracker answers, never a saved copy (`checkHealth` in @tracker/client).
export type HealthRead = (signal: AbortSignal) => Promise<unknown>;

// What a check of the tracker found; null when its failure says nothing about the tracker.
export type TrackerCheck = () => Promise<ApiSignal | null>;

// The tracker answers this read at once. A check left waiting, as on a proxy that holds the
// connection to a stuck API, kept the tracker reachable and every later bare 5xx unchecked
// (PT-109).
export const CHECK_TIMEOUT_MS = 3_000;

// The check goes around the query and mutation caches, so its answer is final: a bare 5xx to it
// too means the proxy can't reach the API.
async function signalOfRead(read: () => Promise<unknown>): Promise<ApiSignal | null> {
  try {
    await read();
    return 'reachable';
  } catch (error) {
    const signal = signalOfError(error);
    return signal === 'unsure' ? 'unreachable' : signal;
  }
}

// Late is settled before the read is stopped, so the race takes it over the read's AbortError.
async function checkInTime(read: HealthRead): Promise<ApiSignal | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<ApiSignal>((resolve) => {
    timer = setTimeout(() => {
      resolve('unreachable');
      controller.abort();
    }, CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([signalOfRead(() => read(controller.signal)), late]);
  } finally {
    clearTimeout(timer);
  }
}

// The banner and the draft retries watch the same requests, so both see a bare 5xx at once. They
// share its check: one GET /api/health, not one each (PT-109).
export function sharedCheck(read: HealthRead): TrackerCheck {
  let running: Promise<ApiSignal | null> | null = null;
  return () => {
    running ??= checkInTime(read).finally(() => {
      running = null;
    });
    return running;
  };
}

const checks = new WeakMap<object, TrackerCheck>();

export function trackerCheckOf(client: Pick<TrackerClient, 'checkHealth'>): TrackerCheck {
  const known = checks.get(client);
  if (known) return known;
  const check = sharedCheck((signal) => client.checkHealth({ signal }));
  checks.set(client, check);
  return check;
}
