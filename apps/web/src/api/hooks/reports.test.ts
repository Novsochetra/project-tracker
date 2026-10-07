import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReportPreview } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../queryKeys';
import { isInvalidated, seedTicket, setupApi } from '../test/render';
import { REPORT_PREVIEW_DELAY_MS, useApplyReport, useReportPreview } from './reports';

const preview: ReportPreview = {
  items: [
    {
      key: 'MOB-1',
      matched: true,
      ticketKey: 'MOB-1',
      ticketTitle: 'Ticket 1',
      fromStatusName: 'To do',
      toStatusName: 'Need review',
    },
  ],
  matchedCount: 1,
};

describe('useReportPreview', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for typing to pause before asking the server', async () => {
    vi.useFakeTimers();
    const previewReport = vi.fn().mockResolvedValue(preview);
    const { wrapper } = setupApi({ previewReport });
    const { result, rerender } = renderHook(({ text }) => useReportPreview(text, 'MOB-1'), {
      wrapper,
      initialProps: { text: '' },
    });

    rerender({ text: 'TICKET: MOB' });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ text: 'TICKET: MOB-1' });
    await act(() => vi.advanceTimersByTimeAsync(REPORT_PREVIEW_DELAY_MS - 1));
    expect(previewReport).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(previewReport).toHaveBeenCalledTimes(1);
    expect(previewReport).toHaveBeenCalledWith({ text: 'TICKET: MOB-1', ticketKey: 'MOB-1' });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toEqual(preview);
  });

  it('asks for nothing and shows nothing for blank text', async () => {
    vi.useFakeTimers();
    const previewReport = vi.fn().mockResolvedValue(preview);
    const { wrapper } = setupApi({ previewReport });
    const { result, rerender } = renderHook(({ text }) => useReportPreview(text), {
      wrapper,
      initialProps: { text: 'TICKET: MOB-1' },
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toEqual(preview);

    rerender({ text: '   ' });
    expect(result.current.data).toBeUndefined();
    await act(() => vi.advanceTimersByTimeAsync(REPORT_PREVIEW_DELAY_MS * 2));
    expect(previewReport).toHaveBeenCalledTimes(1);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useApplyReport', () => {
  it('refreshes boards and tickets the report may have changed', async () => {
    const applyReport = vi.fn().mockResolvedValue({ updatedTicketKeys: ['MOB-1'] });
    const { queryClient, wrapper } = setupApi({ applyReport });
    seedTicket(queryClient);
    const { result } = renderHook(() => useApplyReport(), { wrapper });

    act(() => result.current.mutate({ text: 'TICKET: MOB-1\nSTATUS: done' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(applyReport).toHaveBeenCalledWith({ text: 'TICKET: MOB-1\nSTATUS: done' });
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
  });

  it('refreshes the ticket it was opened from, although that ticket is the mutation target', async () => {
    const { queryClient, wrapper } = setupApi({
      applyReport: vi.fn().mockResolvedValue({ updatedTicketKeys: ['MOB-1'] }),
    });
    seedTicket(queryClient);
    const { result } = renderHook(() => useApplyReport(), { wrapper });

    act(() => result.current.mutate({ text: 'STATUS: done', ticketKey: 'MOB-1' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
  });
});
