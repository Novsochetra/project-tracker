import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { SAVE_MARKS_STORAGE_KEY } from '../../src/features/ticket/fields/saveMarks';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { keepDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'comment-edit:c1';
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

// A tab that was frozen or killed while it saved a comment edit, its ticket left: the edit stays
// kept with Save pressed, and the tab's mark of its save counts for another minute.
function leftByAKilledTab() {
  keepDraft(
    ID,
    {
      ticketKey: 'MOB-1',
      field: 'comment-edit',
      activityId: 'c1',
      text: 'First thought, edited',
      submitted: true,
    },
    'First thought',
  );
  const mark = { draft: ID, page: 'killed-tab', until: Date.now() + MARK_LEFT_MS };
  localStorage.setItem(`${SAVE_MARKS_STORAGE_KEY}:killed-tab:${ID}`, JSON.stringify(mark));
}

// Reviewer 96 (PT-105, PT-135): nothing woke the app-wide sync when such a tab's mark ran out
// (only comments left on their way did), so the edit waited for the next start, `online`,
// reconnect or change in its project: 62.6 s in an open tab.
it('sends a comment edit a killed tab left on its way once that tab’s mark runs out', async () => {
  leftByAKilledTab();
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  const rendered = renderTicket({ detail: server.detail, client: server.client, children: <p /> });
  cleanups.push(rendered.restorePhone);
  // The start's run leaves it to the tab still marked as saving it.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(server.client.updateComment).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(MARK_LEFT_MS);
  });
  await waitFor(() => expect(server.detail.activity[0]?.text).toBe('First thought, edited'));
  expect(server.client.updateComment).toHaveBeenCalledTimes(1);
});
