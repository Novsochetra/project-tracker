import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attachment, TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { addTicketAttachment } from '../../src/api/cache/ticketDetail';
import { queryKeys } from '../../src/api/queryKeys';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  renderTicket,
  type RenderTicketOptions,
} from '../../src/features/ticket/test/renderTicket';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 62 (PT-91): the ticket's own file list read `activityId` on every entry, so one it
// can't read, such as null, failed the whole Ticket screen. Adding a file read `id` on each too.

const ODD = [null, {}, [1]];
const A1 = attachment('a1');
const A2 = attachment('a2');
const PDF = attachment('a3', { fileName: 'notes.pdf', mimeType: 'application/pdf' });

const withOdd = (): TicketDetail =>
  makeTicketDetail(undefined, {
    attachments: [ODD[0], A1, ODD[1], ODD[2], A2] as unknown as Attachment[],
  });

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

function open(phone: boolean, client: RenderTicketOptions['client'] = {}) {
  const rendered = renderTicket({ detail: withOdd(), phone, client });
  cleanups.push(rendered.restorePhone);
  const cached = () =>
    rendered.queryClient.getQueryData<TicketDetail>(queryKeys.ticket('MOB-1'))?.attachments;
  return { ...rendered, cached };
}

describe('regression: a ticket file entry it cannot read', () => {
  it('adds a file and keeps those entries in the cache as they came', () => {
    const next = addTicketAttachment(withOdd(), PDF);
    expect(next.attachments).toEqual([null, A1, {}, [1], A2, PDF]);
    expect(addTicketAttachment(next, PDF)).toBe(next);
  });

  it.each([
    ['a desktop', false],
    ['a phone', true],
  ])('shows the other files on %s', (_, phone) => {
    open(phone);
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open image 2' })).toBeInTheDocument();
  });

  it('adds a file', async () => {
    const user = userEvent.setup();
    const uploadAttachment = vi.fn().mockResolvedValue(PDF);
    const { cached } = open(false, { uploadAttachment });
    const file = new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Add files to ticket'), file);

    await waitFor(() => expect(cached()).toEqual([null, A1, {}, [1], A2, PDF]));
    expect(screen.getByRole('button', { name: 'Remove notes.pdf' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('removes a file', async () => {
    const user = userEvent.setup();
    const deleteAttachment = vi.fn().mockResolvedValue(undefined);
    const { cached } = open(false, { deleteAttachment });
    await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
    await new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(deleteAttachment).toHaveBeenCalledWith('a2');
    await waitFor(() => expect(cached()).toEqual([null, A1, {}, [1]]));
    expect(screen.queryByRole('button', { name: 'Open image 2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
  });
});
