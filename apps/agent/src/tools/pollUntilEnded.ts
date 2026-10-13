import { RUN_REQUEST_WAIT_MS } from '@tracker/shared';
import { retryDelay, worthRetrying } from '../watch/retry';
import { wait } from '../watch/wait';

// A wait the tracker holds a little longer than it should is still answered, but one a proxy
// keeps open forever is dropped and asked again.
const WAIT_TIMEOUT_MS = RUN_REQUEST_WAIT_MS + 15_000;

export interface PollOptions<T> {
  // One long poll: the tracker answers once it ended or after about 25 s with it still open.
  waitOnce: (signal: AbortSignal) => Promise<T>;
  isOpen: (value: T) => boolean;
  // On this computer's clock, so a tracker that can't be reached doesn't keep Claude forever.
  limitMs: number;
  signal: AbortSignal;
  now?: () => number;
  retryDelay?: (attempt: number) => number;
}

export type PollEnd<T> = { kind: 'ended'; value: T } | { kind: 'timedOut' } | { kind: 'aborted' };

// The network and the tracker's restarts are waited out; a refusal (a 4xx) is thrown, since every
// later wait would get it too.
export async function pollUntilEnded<T>(options: PollOptions<T>): Promise<PollEnd<T>> {
  const now = options.now ?? Date.now;
  const delay = options.retryDelay ?? retryDelay;
  const giveUpAt = now() + options.limitMs;
  let failures = 0;
  while (!options.signal.aborted) {
    if (now() >= giveUpAt) return { kind: 'timedOut' };
    try {
      const timeout = AbortSignal.any([options.signal, AbortSignal.timeout(WAIT_TIMEOUT_MS)]);
      const seen = await options.waitOnce(timeout);
      if (!options.isOpen(seen)) return { kind: 'ended', value: seen };
      failures = 0;
    } catch (error) {
      if (options.signal.aborted) break;
      if (!worthRetrying(error)) throw error;
      await wait(delay(failures), options.signal);
      failures += 1;
    }
  }
  return { kind: 'aborted' };
}
