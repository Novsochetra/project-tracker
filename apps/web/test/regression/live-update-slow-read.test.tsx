import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { refreshForChange } from '../../src/api/live/refreshForChange';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';
import { slowReads } from './slowReads';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Seen on a production build with ticket reads delayed 6 s: an agent renamed the ticket, and the
// live update's refetch got the service worker's saved copy, which can't have the change that
// caused it. The new title only showed after a reload.
it('shows a change a live update reports when reads are slower than the service worker waits', async () => {
  const slow = slowReads(makeTicketDetail());
  const { queryClient, restorePhone } = renderTicket({
    detail: slow.tracker(),
    client: slow.page('answer'),
  });
  cleanups.push(restorePhone);
  slow.edit({ title: 'Renamed by an agent' });
  act(() => {
    refreshForChange(queryClient, { type: 'changed', projectId: 'p-mob', ticketId: 't-1' });
  });
  await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Renamed by an agent'));
});
