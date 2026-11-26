import { retryDelay, worthRetrying } from '../backoff';
import { wait } from '../wait';

export interface RetryOptions {
  onWait: (error: unknown) => void;
  signal?: AbortSignal | undefined;
  delay?: ((attempt: number) => number) | undefined;
}

// A deploy restarts the tracker for a minute or two, and a laptop wakes before its network.
export async function retryUntilAnswered<T>(
  task: () => Promise<T>,
  { onWait, signal, delay = retryDelay }: RetryOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!worthRetrying(error) || signal?.aborted) throw error;
      if (attempt === 0) onWait(error);
      await wait(delay(attempt), signal);
    }
  }
}
