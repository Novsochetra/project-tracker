import type { RunEvent } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { queryKeys } from '../queryKeys';
import { makeTicketDetail } from '../test/fixtures';
import { isInvalidated, setupApi } from '../test/render';
import { refreshForRun } from './refreshForRun';

const runEvent = (status: RunEvent['status']): RunEvent => ({
  type: 'run',
  runId: 'r-1',
  runnerId: 'h-1',
  projectId: 'p-mob',
  ticketId: 't-1',
  chatId: null,
  status,
});

function setup() {
  const api = setupApi();
  api.queryClient.setQueryData(queryKeys.ticket('MOB-1'), makeTicketDetail());
  api.queryClient.setQueryData(queryKeys.ticketQuestions('MOB-1'), []);
  return api.queryClient;
}

describe("a ticket run's end", () => {
  it('reads the questions Claude asked on the ticket again, since the run ends them', () => {
    const queryClient = setup();
    refreshForRun(queryClient, runEvent('cancelled'));
    expect(isInvalidated(queryClient, queryKeys.ticketQuestions('MOB-1'))).toBe(true);
  });

  it('leaves them while the run works', () => {
    const queryClient = setup();
    refreshForRun(queryClient, runEvent('running'));
    expect(isInvalidated(queryClient, queryKeys.ticketQuestions('MOB-1'))).toBe(false);
  });
});
