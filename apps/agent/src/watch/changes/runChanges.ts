import { prepareDiff, type FinishRunInput, type RunJob } from '@tracker/shared';
import { runName } from '../runName';
import type { WatchApi } from '../watchApi';
import { readDiff } from './readDiff';
import { snapshotTree } from './snapshot';

export interface ChangesDeps {
  api: Pick<WatchApi, 'addRunChanges'>;
  cwd: string;
  runnerId: string;
  log: (text: string) => void;
  describe: (error: unknown) => string;
}

export type SendChanges = (outcome: FinishRunInput) => Promise<void>;

const NOTHING: SendChanges = () => Promise.resolve();

// For all the git calls of one end together, and for the send, so a large folder or a tracker
// that hangs can't hold up the run's end for long.
const GIT_DEADLINE_MS = 30_000;
const SEND_TIMEOUT_MS = 30_000;

// Only a ticket's own work run changes its code: a review only reads it, and a batch's sub agents
// share the folder, so its diff is no one ticket's.
const tracks = ({ run }: RunJob) => run.kind === 'ticket' && run.role === 'work';

async function sendChanges(deps: ChangesDeps, job: RunJob, from: string): Promise<void> {
  const deadline = AbortSignal.timeout(GIT_DEADLINE_MS);
  const to = await snapshotTree(deps.cwd, deadline);
  if (!to) throw new Error("Couldn't read the folder's files with git.");
  const { raw, cut } = await readDiff(deps.cwd, { from, to }, deadline);
  await deps.api.addRunChanges(
    job.run.id,
    { runnerId: deps.runnerId, ...prepareDiff(raw, cut) },
    { signal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
  );
}

// A snapshot before Claude starts and one after it exits, so edits and files that were there before
// the run stay out of its change. Changes never stop or fail a run.
export async function trackRunChanges(deps: ChangesDeps, job: RunJob): Promise<SendChanges> {
  if (!tracks(job)) return NOTHING;
  const start = await snapshotTree(deps.cwd, AbortSignal.timeout(GIT_DEADLINE_MS)).catch(
    () => null,
  );
  if (!start) return NOTHING;
  return async (outcome) => {
    // The person's cancel has ended the run on the tracker already.
    if (outcome.status === 'cancelled') return;
    try {
      await sendChanges(deps, job, start);
    } catch (error) {
      deps.log(`${runName(job.run)}: Couldn't send the changes: ${deps.describe(error)}`);
    }
  };
}
