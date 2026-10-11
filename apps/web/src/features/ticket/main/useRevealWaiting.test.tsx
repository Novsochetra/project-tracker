import { act, screen, waitFor } from '@testing-library/react';
import type { RunRequest } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshRunRequests } from '../../../api/live/refreshForRun';
import { queryKeys } from '../../../api/queryKeys';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { makeRequest } from '../../../api/test/requestFixtures';
import { makeRun } from '../../../api/test/runFixtures';
import { skipAnimations } from '../../../overlays/testing';
import type * as RevealActions from '../../requests/revealActions';
import { revealInSight } from '../../requests/revealActions';
import { renderTicket } from '../test/renderTicket';

vi.mock('../../requests/revealActions', async (importOriginal) => ({
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

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup(read: () => Promise<RunRequest[]>) {
  const detail = makeTicketDetail(listItem(1, STATUS.progress, 0));
  const listTicketRuns = vi.fn().mockResolvedValue([running]);
  const listRunRequests = vi.fn(read);
  const rendered = renderTicket({
    detail,
    phone: true,
    client: { listTicketRuns, listRunRequests },
  });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const requestCard = () => screen.findByRole('region', { name: 'Claude asks: Edit src/rotate.ts' });

describe('a ticket opened while Claude waits on it', () => {
  it('brings the open request into sight', async () => {
    setup(() => Promise.resolve([asked]));
    const card = await requestCard();
    await waitFor(() => expect(revealInSight).toHaveBeenCalledWith(card));
    expect(revealInSight).toHaveBeenCalledTimes(1);
  });

  it('leaves the screen where it is for a request that comes after it opened', async () => {
    let requests: RunRequest[] = [];
    const { queryClient } = setup(() => Promise.resolve(requests));
    const runCard = await screen.findByRole('region', { name: 'Claude Code run' });
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.runRequests(running.id))).toEqual([]),
    );

    requests = [asked];
    act(() => refreshRunRequests(queryClient, running.id));
    expect(runCard).toContainElement(await requestCard());
    expect(revealInSight).not.toHaveBeenCalled();
  });

  it('leaves it alone for a request that already ended', async () => {
    setup(() => Promise.resolve([{ ...asked, status: 'expired', endedAt: Date.now() }]));
    expect(await requestCard()).toHaveTextContent('No answer');
    expect(revealInSight).not.toHaveBeenCalled();
  });
});
