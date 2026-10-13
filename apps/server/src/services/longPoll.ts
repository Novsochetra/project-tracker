import type { ChangeNotice } from '../events/changeNotice';
import type { RunNotice } from '../events/runNotice';
import type { ServiceContext } from './context';

export interface Wakes {
  change?: (notice: ChangeNotice) => boolean;
  run?: (notice: RunNotice) => boolean;
}

export interface Woken {
  woken: Promise<void>;
  stop: () => void;
}

export function untilWoken(
  ctx: ServiceContext,
  wakes: Wakes,
  ms: number,
  signal: AbortSignal,
): Woken {
  let stop = () => undefined as void;
  const woken = new Promise<void>((resolve) => {
    const timer = setTimeout(() => stop(), ms);
    const unsubscribe = [
      ctx.events.subscribe((notice) => wakes.change?.(notice) && stop()),
      ctx.runEvents.subscribe((notice) => wakes.run?.(notice) && stop()),
    ];
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
  wakes: (first: T) => Wakes;
  waitMs: (value: T) => number;
  signal: AbortSignal;
}

// Answers at once when the thing already ended, else once something that may end it happens or
// the wait is up, with it read again either way: the caller asks again while it is still open.
export async function longPoll<T>(ctx: ServiceContext, poll: LongPoll<T>): Promise<T> {
  const first = await poll.read();
  if (!poll.isOpen(first)) return first;
  const wait = untilWoken(ctx, poll.wakes(first), poll.waitMs(first), poll.signal);
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
