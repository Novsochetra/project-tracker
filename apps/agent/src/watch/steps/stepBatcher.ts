import { ApiError } from '@tracker/client';
import { RUN_STEPS_BATCH_MAX, RUN_STEPS_KEPT, type RunStepInput } from '@tracker/shared';

export const STEP_SEND_MS = 1000;

// Every later send of the run would get the same answer: the run ended (the person cancelled,
// 409), the token can't send them, or the tracker is older than steps (404).
const REFUSED = new Set([401, 403, 404, 409]);

export interface StepBatcherDeps {
  send: (steps: RunStepInput[]) => Promise<void>;
  log: (text: string) => void;
  describe: (error: unknown) => string;
  every?: number | undefined;
}

export interface StepBatcher {
  add: (steps: readonly RunStepInput[]) => void;
  // Sends what is left; the run's end is reported only after, so no step comes after it.
  end: () => Promise<void>;
}

// Steps go about once a second rather than one request each. They only show what Claude does, so
// a send that fails is dropped and never stops or fails the run.
export function createStepBatcher({
  send,
  log,
  describe,
  every = STEP_SEND_MS,
}: StepBatcherDeps): StepBatcher {
  let waiting: RunStepInput[] = [];
  let sending: Promise<void> | undefined;
  let open = true;
  let refused = false;
  let warned = false;

  function onFailure(error: unknown) {
    const status = error instanceof ApiError ? error.status : undefined;
    if (status !== undefined && REFUSED.has(status)) refused = true;
    if (warned || status === 409) return;
    warned = true;
    log(`Couldn't show the tracker what Claude is doing: ${describe(error)}`);
  }

  async function sendWaiting() {
    while (waiting.length > 0 && !refused) {
      const batch = waiting.splice(0, RUN_STEPS_BATCH_MAX);
      try {
        await send(batch);
      } catch (error) {
        // That batch is lost; the rest waits for the next round rather than fail in a row.
        onFailure(error);
        return;
      }
    }
  }

  const flush = (): Promise<void> => {
    sending ??= sendWaiting().finally(() => {
      sending = undefined;
    });
    return sending;
  };

  const timer = setInterval(() => void flush(), every);
  timer.unref();

  return {
    add(steps) {
      if (!open || refused) return;
      // A tracker that can't be reached mustn't make the helper hold a whole run.
      waiting = [...waiting, ...steps].slice(-RUN_STEPS_KEPT);
    },
    async end() {
      open = false;
      clearInterval(timer);
      await sending;
      await flush();
    },
  };
}
