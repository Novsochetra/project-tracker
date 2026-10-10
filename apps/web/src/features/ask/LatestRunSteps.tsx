import type { Run } from '@tracker/shared';
import type { RunRequests } from '../requests/useRequests';
import type { StepRow } from '../steps/stepRows';
import { stoppedWithSteps } from './chatFooter';
import { StoppedSteps } from './StoppedSteps';
import { WorkingMessage } from './WorkingMessage';

export interface LatestRunStepsProps {
  run: Run | null | undefined;
  working: StepRow[];
  requests: RunRequests;
}

// A request that comes before any step shows the working message too.
export function LatestRunSteps({ run, working, requests }: LatestRunStepsProps) {
  if (run && (working.length > 0 || requests.shown.length > 0)) {
    return <WorkingMessage runId={run.id} rows={working} requests={requests} />;
  }
  const stopped = stoppedWithSteps(run);
  return stopped && <StoppedSteps run={stopped} />;
}
