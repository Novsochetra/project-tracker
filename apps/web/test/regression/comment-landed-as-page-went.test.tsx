import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { keptComment } from '../../src/features/ticket/activity/sentComments';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { storedDrafts } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

const sendsKept = () => storedDrafts().filter(([, draft]) => draft.field === 'comment-send');

const pageGoes = () =>
  act(() => {
    window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }));
  });

// PT-111 (from PT-105): the tracker had the comment, but its answer hadn't reached the page when
// the page went. The page put the comment back in the box as it went, so it showed twice: once
// in the ticket and once in the box, ready to be sent again.
it('leaves a comment on its way to the next check when its page goes, which finds it landed', async () => {
  const user = userEvent.setup();
  const landed = makeTicketDetail(undefined, { activity: [comment('c9', 'Looks good')] });
  const first = renderTicket({
    client: { addComment: vi.fn().mockReturnValue(new Promise<never>(() => {})) },
  });
  cleanups.push(first.restorePhone);
  await user.type(screen.getByLabelText('Comment'), 'Looks good');
  await user.click(screen.getByRole('button', { name: 'Comment' }));

  pageGoes();
  expect(keptComment('MOB-1')).toBeUndefined();
  expect(sendsKept()).toHaveLength(1);

  // The next start reads the ticket, which has the comment.
  first.unmount();
  const next = renderTicket({
    detail: landed,
    client: { getTicket: vi.fn().mockResolvedValue(landed) },
  });
  cleanups.push(next.restorePhone);
  await waitFor(() => expect(sendsKept()).toEqual([]));
  expect(screen.getByLabelText('Comment')).toHaveValue('');
  expect(keptComment('MOB-1')).toBeUndefined();
});
