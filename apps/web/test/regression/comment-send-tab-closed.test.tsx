import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { keptComment } from '../../src/features/ticket/activity/sentComments';
import { isSavingAnywhere } from '../../src/features/ticket/fields/fieldSaves';
import { keepDraft, storedDrafts } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function sendHangs() {
  const addComment = vi.fn().mockReturnValue(new Promise<never>(() => {}));
  const rendered = renderTicket({ client: { addComment } });
  cleanups.push(rendered.restorePhone);
  return addComment;
}

async function send(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Comment'), text);
  await user.click(screen.getByRole('button', { name: 'Comment' }));
  return user;
}

const pageGoes = (persisted: boolean) =>
  act(() => {
    window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted }));
  });

const sendsKept = () => storedDrafts().filter(([, draft]) => draft.field === 'comment-send');

// Reviewer 77 (PT-90): a tab closed while its comment send hung lost the comment: the box had let
// it go when it was sent, and closing the page didn't ask.
it('keeps a comment on its way, so closing the page asks first', async () => {
  const addComment = sendHangs();
  await send('Looks good');
  expect(addComment).toHaveBeenCalled();
  expect(screen.getByLabelText('Comment')).toHaveValue('');

  expect(sendsKept().map(([, draft]) => draft.text)).toEqual(['Looks good']);
  expect(hasDrafts()).toBe(true);
});

// It may have reached the tracker as the page went (PT-111): it stays kept for the next check,
// which reads the ticket first, instead of going back in the box at once.
it('keeps a comment still on its way when the page goes, for a check of the ticket', async () => {
  sendHangs();
  const user = await send('Looks good');
  await user.type(screen.getByLabelText('Comment'), 'Also the logout');

  pageGoes(true);
  pageGoes(false);
  expect(keptComment('MOB-1')).toBe('Also the logout');
  expect(sendsKept().map(([, draft]) => draft.text)).toEqual(['Looks good']);
  expect(isSavingAnywhere(sendsKept()[0]?.[0] ?? '')).toBe(false);
});

// A tab that was killed (no pagehide) leaves the comment kept; the next start reads the ticket.
function keptByAKilledTab(text: string) {
  keepDraft(
    'comment-send:k1',
    { ticketKey: 'MOB-1', field: 'comment-send', activityId: 'k1', text },
    '0',
  );
}

it('brings back a comment a killed tab left on its way when the ticket lacks it', async () => {
  keptByAKilledTab('Lost words');
  const detail = makeTicketDetail();
  const rendered = renderTicket({
    detail,
    client: { getTicket: vi.fn().mockResolvedValue(detail) },
  });
  cleanups.push(rendered.restorePhone);
  await waitFor(() => expect(screen.getByLabelText('Comment')).toHaveValue('Lost words'));
  expect(sendsKept()).toEqual([]);
});

it('lets it go when the ticket has it', async () => {
  keptByAKilledTab('Landed words');
  const detail = makeTicketDetail(undefined, { activity: [comment('c9', 'Landed words')] });
  const rendered = renderTicket({
    detail,
    client: { getTicket: vi.fn().mockResolvedValue(detail) },
  });
  cleanups.push(rendered.restorePhone);
  await waitFor(() => expect(sendsKept()).toEqual([]));
  expect(screen.getByLabelText('Comment')).toHaveValue('');
});
