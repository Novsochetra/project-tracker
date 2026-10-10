import { useMemo } from 'react';
import { useRunSteps } from '../../api/hooks/runSteps';
import { stepRows, type StepRow } from './stepRows';

export function useStepRows(runId: string | null): StepRow[] {
  const steps = useRunSteps(runId ?? '', { enabled: runId !== null });
  return useMemo(() => (runId ? stepRows(steps.data ?? []) : []), [runId, steps.data]);
}
