import type { Run } from '@tracker/shared';
import { useRef } from 'react';
import { isWorking } from '../../api/workingRun';
import { useRequests } from '../requests/useRequests';
import { useFollowEnd } from '../steps/useFollowEnd';
import { useStepRows } from '../steps/useStepRows';

// Read here rather than in the working message, so the chat knows where the person is scrolled
// before the first step shows. A request that comes or ends follows the end like a step, so a card
// comes into sight only for someone already there.
export function useWorkingMessage(run: Run | null | undefined) {
  const threadRef = useRef<HTMLDivElement>(null);
  const runId = run && isWorking(run) ? run.id : null;
  const rows = useStepRows(runId);
  const requests = useRequests(runId);
  const requestsKey = requests.shown.map(({ id, status }) => `${id}:${status}`).join();
  useFollowEnd(threadRef, `${rows.at(-1)?.seq}|${requestsKey}`);
  return { threadRef, rows, requests };
}
