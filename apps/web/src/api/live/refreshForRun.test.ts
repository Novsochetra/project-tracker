import { QueryClient } from '@tanstack/react-query';
import type { RunEvent } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { queryKeys } from '../queryKeys';
import { refreshForRun } from './refreshForRun';

const event: RunEvent = {
  type: 'run',
  runId: 'r-1',
  runnerId: 'h-1',
  projectId: 'p-1',
  ticketId: 't-1',
  chatId: null,
  status: 'running',
};

describe('refreshForRun', () => {
  it('refreshes the activity list when a run starts or ends', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.runActivity(), { runs: [], runningCount: 0, limit: 5 });
    refreshForRun(queryClient, event);
    expect(queryClient.getQueryState(queryKeys.runActivity())?.isInvalidated).toBe(true);
  });
});
