import { act, screen, waitFor } from '@testing-library/react';
import type { Run, RunRequest } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api/queryKeys';
import { deferred } from '../../src/api/test/deferred';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { makeRequest } from '../../src/api/test/requestFixtures';
import { makeRun } from '../../src/api/test/runFixtures';
import type * as RevealActions from '../../src/features/requests/revealActions';
import { revealInSight } from '../../src/features/requests/revealActions';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

vi.mock('../../src/features/requests/revealActions', async (importOriginal) => ({
  ...(await importOriginal<typeof RevealActions>()),
  revealInSight: vi.fn(),
}));

const running = makeRun({ status: 'running', startedAt: Date.now() });
const asked = makeRequest({ runId: running.id, label: 'Edit src/rotate.ts' });

let cleanups: Array<() => void> = [];

beforeEach(() => {
  vi.mocked(revealInSight).mockClear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

// The ticket was opened before Claude asked, so its requests were cached as none; the request
// event only marked that cache stale. Tapping the row from the board's mark must still bring the
// card into sight once the requests are read again (PT-168 review).
describe('regression: a ticket reopened while its cached requests are stale', () => {
  it('brings the open request into sight', async () => {
    const runs = deferred<Run[]>();
    const { queryClient, restorePhone } = renderTicket({
      detail: makeTicketDetail(listItem(1, STATUS.progress, 0)),
      phone: true,
      client: {
        listTicketRuns: vi.fn(() => runs.promise),
        listRunRequests: vi.fn((): Promise<RunRequest[]> => Promise.resolve([asked])),
      },
    });
    cleanups.push(restorePhone);
    const queryKey = queryKeys.runRequests(running.id);
    queryClient.setQueryData<RunRequest[]>(queryKey, []);
    void queryClient.invalidateQueries({ queryKey });

    await act(() => {
      runs.resolve([running]);
      return runs.promise;
    });
    const card = await screen.findByRole('region', { name: 'Claude asks: Edit src/rotate.ts' });
    await waitFor(() => expect(revealInSight).toHaveBeenCalledWith(card));
  });
});
