import { act, renderHook, waitFor } from '@testing-library/react';
import type { Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../queryKeys';
import { listItem, STATUS } from '../test/fixtures';
import { boardTicket, cachedTicket, isInvalidated, seedTicket, setupApi } from '../test/render';
import { useMarkSent } from './prompts';

const ticketOf = (num: number, statusId: string, rank: number): Ticket => {
  const { commentCount: _c, attachmentCount: _a, ...ticket } = listItem(num, statusId, rank);

  return ticket;
};

describe('useMarkSent', () => {
  it('writes the ticket the server returns into the board and the detail', async () => {
    const moved = ticketOf(1, STATUS.progress, -1000);
    const { queryClient, wrapper } = setupApi({ markSent: vi.fn().mockResolvedValue(moved) });
    seedTicket(queryClient);
    const { result } = renderHook(() => useMarkSent(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { moveToInProgress: true } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(boardTicket(queryClient, 'MOB-1')).toMatchObject({
      statusId: STATUS.progress,
      rank: -1000,
    });
    expect(cachedTicket(queryClient).status.id).toBe(STATUS.progress);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
  });
});
