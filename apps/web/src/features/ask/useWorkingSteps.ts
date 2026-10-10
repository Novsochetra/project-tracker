import type { Run } from '@tracker/shared';
import { useRef } from 'react';
import { isWorking } from '../../api/workingRun';
import { useFollowEnd } from '../steps/useFollowEnd';
import { useStepRows } from '../steps/useStepRows';

// Read here rather than in the working message, so the chat knows where the person is scrolled
// before the first step shows.
export function useWorkingSteps(run: Run | null | undefined) {
  const threadRef = useRef<HTMLDivElement>(null);
  const rows = useStepRows(run && isWorking(run) ? run.id : null);
  useFollowEnd(threadRef, rows.at(-1)?.seq);
  return { threadRef, rows };
}
