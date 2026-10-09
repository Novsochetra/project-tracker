import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { SAVE_MARKS_STORAGE_KEY } from '../../src/features/ticket/fields/saveMarks';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { keepDraft, storedDrafts } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'comment-send:k1';
const MARK_LEFT_MS = 60_000;

let cleanups: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  vi.useRealTimers();
});

// A tab that was killed while sending a comment: the comment stays kept, and so does the tab's
// mark of its send, which counts for another minute.
function leftByAKilledTab(text: string) {
  keepDraft(ID, { ticketKey: 'MOB-1', field: 'comment-send', activityId: 'k1', text }, '0');
  const mark = { draft: ID, page: 'killed-tab', until: Date.now() + MARK_LEFT_MS };
  localStorage.setItem(`${SAVE_MARKS_STORAGE_KEY}:killed-tab:${ID}`, JSON.stringify(mark));
}

const sendsKept = () => storedDrafts().filter(([, draft]) => draft.field === 'comment-send');

// Reviewer 84 (PT-105): the comment came back only at the next start, `online` or change in its
// project, not when the killed tab's mark ran out: it stayed out of sight 100 s in an open tab.
it('brings back a comment a killed tab left on its way once that tab’s mark runs out', async () => {
  leftByAKilledTab('Lost words');
  const detail = makeTicketDetail();
  const getTicket = vi.fn().mockResolvedValue(detail);
  const rendered = renderTicket({ detail, client: { getTicket } });
  cleanups.push(rendered.restorePhone);
  const box = screen.getByLabelText('Comment');
  // The start's run leaves it to the tab still marked as sending it.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(box).toHaveValue('');
  expect(sendsKept()).toHaveLength(1);

  act(() => {
    vi.advanceTimersByTime(MARK_LEFT_MS);
  });
  await waitFor(() => expect(box).toHaveValue('Lost words'));
  expect(sendsKept()).toEqual([]);
});
