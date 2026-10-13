import { REVIEW_NOT_RECORDED, type FinishRunInput, type RunJob } from '@tracker/shared';
import type { WatchApi } from '../watchApi';

export interface ReviewCheckDeps {
  api: Pick<WatchApi, 'getTicket'>;
  log: (text: string) => void;
  describe: (error: unknown) => string;
}

// review_ticket takes a ticket out of review, so one still there means Claude finished without
// recording a review, and a "done" run would leave the person waiting on nothing.
export async function reviewOutcome(
  { api, log, describe }: ReviewCheckDeps,
  { run }: RunJob,
  outcome: FinishRunInput,
): Promise<FinishRunInput> {
  const { ticketKey } = run;
  if (outcome.status !== 'done' || !ticketKey) return outcome;
  try {
    const { status } = await api.getTicket(ticketKey, { fresh: true });
    if (status.category !== 'in_review') return outcome;
    return { status: 'failed', error: REVIEW_NOT_RECORDED };
  } catch (error) {
    log(`Couldn't check the review on ${ticketKey}: ${describe(error)}`);
    return outcome;
  }
}
