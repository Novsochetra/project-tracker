import type { Broadcaster } from '../events/broadcaster';

export type Wake = (stop: () => void) => () => void;

export const wakeOn =
  <T>(events: Broadcaster<T>, ends: (notice: T) => boolean): Wake =>
  (stop) =>
    events.subscribe((notice) => {
      if (ends(notice)) stop();
    });

export interface Woken {
  woken: Promise<void>;
  stop: () => void;
}

export function untilWoken(wakes: readonly Wake[], ms: number, signal: AbortSignal): Woken {
  let stop = () => undefined as void;
  const woken = new Promise<void>((resolve) => {
    const timer = setTimeout(() => stop(), ms);
    const unsubscribe = wakes.map((wake) => wake(() => stop()));
    stop = () => {
      clearTimeout(timer);
      unsubscribe.forEach((off) => off());
      signal.removeEventListener('abort', stop);
      resolve();
    };

    signal.addEventListener('abort', stop);
    if (signal.aborted) stop();
  });

  return { woken, stop: () => stop() };
}

export interface LongPoll<T> {
  read: () => Promise<T>;
  isOpen: (value: T) => boolean;
  // From the first read, so a caller needs no read of its own to know what to wake on.
  wakes: (first: T) => Wake[];
  waitMs: (value: T) => number;
  signal: AbortSignal;
}

// Answers at once when the thing already ended, else once something that may end it happens or
// the wait is up, with it read again either way: the caller asks again while it is still open.
export async function longPoll<T>(poll: LongPoll<T>): Promise<T> {
  const first = await poll.read();
  if (!poll.isOpen(first)) return first;
  const wait = untilWoken(poll.wakes(first), poll.waitMs(first), poll.signal);
  try {
    // Read again once listening, so an end in between isn't missed.
    if (!poll.isOpen(await poll.read())) wait.stop();
  } catch (error) {
    wait.stop();
    throw error;
  }

  await wait.woken;

  return poll.read();
}
