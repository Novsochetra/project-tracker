import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attachment, TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { addTicketAttachment, removeAttachment } from '../../src/api/cache/ticketDetail';
import { queryKeys } from '../../src/api/queryKeys';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 69 (PT-93): with the ticket's list of files sent as null, the Ticket screen showed, but
// adding a file said "notes.pdf didn't upload. Can't reach the tracker." although the tracker kept
// it: putting the new file in the cache called .some on null.

const PDF = attachment('a3', { fileName: 'notes.pdf', mimeType: 'application/pdf' });

const withoutList = (): TicketDetail =>
  makeTicketDetail(undefined, { attachments: null as unknown as Attachment[] });

let cleanups: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  consoleError.mockRestore();
});

describe('regression: a ticket whose list of files came as null', () => {
  it('adds and removes a file in the cache', () => {
    expect(addTicketAttachment(withoutList(), PDF).attachments).toEqual([PDF]);
    expect(removeAttachment(withoutList(), 'a3').attachments).toBeNull();
  });

  it('adds a file without saying it did not upload', async () => {
    const user = userEvent.setup();
    const uploadAttachment = vi.fn().mockResolvedValue(PDF);
    const rendered = renderTicket({ detail: withoutList(), client: { uploadAttachment } });
    cleanups.push(rendered.restorePhone);
    const cached = () =>
      rendered.queryClient.getQueryData<TicketDetail>(queryKeys.ticket('MOB-1'))?.attachments;

    const file = new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Add files to ticket'), file);

    await waitFor(() => expect(cached()).toEqual([PDF]));
    expect(screen.getByRole('button', { name: 'Remove notes.pdf' })).toBeInTheDocument();
    expect(screen.queryByText(/didn't upload/)).toBeNull();
  });
});
