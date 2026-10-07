import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../test/deferred';
import { attachment, comment, listItem, makeTicketDetail, STATUS } from '../test/fixtures';
import { cachedTicket, seedTicket, setupApi } from '../test/render';
import { useDeleteAttachment, useUploadAttachment } from './attachments';

describe('useUploadAttachment', () => {
  it('uploads a GIF untouched and shows it on the ticket', async () => {
    const uploaded = attachment('img-9', { fileName: 'cat.gif', mimeType: 'image/gif' });
    const uploadAttachment = vi.fn().mockResolvedValue(uploaded);
    const { queryClient, wrapper } = setupApi({ uploadAttachment });
    seedTicket(queryClient);
    const { result } = renderHook(() => useUploadAttachment(), { wrapper });
    const file = new File(['gif'], 'cat.gif', { type: 'image/gif' });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync({ file, ticketKey: 'MOB-1' });
    });

    expect(returned).toEqual(uploaded);
    expect(uploadAttachment).toHaveBeenCalledWith(file, 'cat.gif', 'MOB-1');
    expect(cachedTicket(queryClient).attachments).toEqual([uploaded]);
  });

  it('uploads a pending image without touching any ticket', async () => {
    const uploadAttachment = vi.fn().mockResolvedValue(attachment('img-1', { ticketId: null }));
    const { wrapper } = setupApi({ uploadAttachment });
    const { result } = renderHook(() => useUploadAttachment(), { wrapper });
    const file = new File(['gif'], 'a.gif', { type: 'image/gif' });

    await act(() => result.current.mutateAsync({ file }));

    expect(uploadAttachment).toHaveBeenCalledWith(file, 'a.gif', undefined);
  });
});

describe('useDeleteAttachment', () => {
  it('removes the image at once and restores it on failure', async () => {
    const request = deferred<void>();
    const { queryClient, wrapper } = setupApi({ deleteAttachment: vi.fn(() => request.promise) });
    const image = attachment('img-1');
    seedTicket(
      queryClient,
      makeTicketDetail(listItem(1, STATUS.todo, 0), {
        attachments: [image],
        activity: [comment('a1', '', { attachments: [image] })],
      }),
    );
    const { result } = renderHook(() => useDeleteAttachment(), { wrapper });

    act(() => result.current.mutate({ attachmentId: 'img-1', ticketKey: 'MOB-1' }));
    await waitFor(() => expect(cachedTicket(queryClient).attachments).toEqual([]));
    expect(cachedTicket(queryClient).activity[0]?.attachments).toEqual([]);

    request.reject(new TypeError('Failed to fetch'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cachedTicket(queryClient).attachments).toEqual([image]);
  });
});
