import type { Run } from '@tracker/shared';
import type { StepRow } from '../steps/stepRows';
import { stoppedWithSteps } from './chatFooter';
import { StoppedSteps } from './StoppedSteps';
import { WorkingMessage } from './WorkingMessage';

export interface LatestRunStepsProps {
  run: Run | null | undefined;
  working: StepRow[];
}

export function LatestRunSteps({ run, working }: LatestRunStepsProps) {
  if (run && working.length > 0) return <WorkingMessage runId={run.id} rows={working} />;
  const stopped = stoppedWithSteps(run);
  return stopped && <StoppedSteps run={stopped} />;
}
