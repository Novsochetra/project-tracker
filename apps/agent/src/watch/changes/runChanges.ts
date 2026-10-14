import { prepareDiff, type FinishRunInput, type RunJob } from '@tracker/shared';
import { runName } from '../runName';
import type { WatchApi } from '../watchApi';
import { diffBaseOf, headOf } from './diffBase';
import { readDiff } from './readDiff';

export interface ChangesDeps {
  api: Pick<WatchApi, 'addRunChanges'>;
  cwd: string;
  runnerId: string;
  log: (text: string) => void;
  describe: (error: unknown) => string;
}

export type SendChanges = (outcome: FinishRunInput) => Promise<void>;

const NOTHING: SendChanges = () => Promise.resolve();

// A tracker that hangs mustn't hold up the run's end.
const SEND_TIMEOUT_MS = 30_000;

// Only a ticket's own work run changes its code: a review only reads it, and a batch's sub agents
// share the folder, so its diff is no one ticket's.
const tracks = ({ run }: RunJob) => run.kind === 'ticket' && run.role === 'work';

async function sendChanges(deps: ChangesDeps, job: RunJob, start: string): Promise<void> {
  const { raw, cut } = await readDiff(deps.cwd, await diffBaseOf(deps.cwd, start));
  const prepared = prepareDiff(raw, cut);
  await deps.api.addRunChanges(
    job.run.id,
    { runnerId: deps.runnerId, ...prepared },
    { signal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
  );
}

// Notes the commit the folder is on before Claude starts; once Claude exits, the folder's change
// since then (or since its branch left the default one) goes to the tracker, masked and capped.
// Changes never stop or fail a run.
export async function trackRunChanges(deps: ChangesDeps, job: RunJob): Promise<SendChanges> {
  if (!tracks(job)) return NOTHING;
  const start = await headOf(deps.cwd).catch(() => null);
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
