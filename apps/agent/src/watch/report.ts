import { ApiError } from '@tracker/client';
import type { FinishRunInput } from '@tracker/shared';
import type { WatchApi } from './watchApi';
import { retryDelay, wait } from './retryDelay';

const REPORT_TRIES = 20;

const worthRetrying = (error: unknown): boolean =>
  !(error instanceof ApiError) || error.status >= 500 || error.status === 429;

// A deploy restarts the tracker for a minute or two; the run's end must still reach it.
export async function reportEnd(
  api: WatchApi,
  runId: string,
  outcome: FinishRunInput,
  delay: (attempt: number) => number = retryDelay,
): Promise<string | undefined> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await api.finishRun(runId, outcome);
      return undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!worthRetrying(error) || attempt + 1 >= REPORT_TRIES) return message;
      await wait(delay(attempt));
    }
  }
}
