import { render, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft, storedDraft } from '../../src/lib/storedDrafts';

function Drafts() {
  useTicketDrafts(true);
  return null;
}

const TICKETS = {
  'MOB-1': makeTicketDetail(listItem(1, STATUS.todo, 0), {
    activity: [comment('c1', 'First thought'), comment('c2', 'Second thought')],
  }),
  'MOB-2': makeTicketDetail(listItem(2, STATUS.todo, 0)),
};

const REFUSED = new ApiError(
  400,
  'invalid_input',
  'text: Too small: expected at least 1 character',
);

function renderDrafts() {
  const api = setupApi({
    getTicket: vi.fn((key: keyof typeof TICKETS) => Promise.resolve(TICKETS[key])),
    updateComment: vi.fn().mockRejectedValue(REFUSED),
    updateTicket: vi.fn().mockResolvedValue(TICKETS['MOB-2'].ticket),
  });
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  return api;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// An emptied comment edit left open was kept and sent at every start and reconnect. The tracker
// refused it (400: a comment needs text) and the app-wide sync stopped there, so a description
// typed offline in another ticket was never saved until that ticket was opened.
it('saves the other drafts when the tracker refuses one', async () => {
  keepDraft(
    'comment-edit:c1',
    { ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'c1', text: '' },
    'First thought',
  );
  keepDraft(
    'comment-edit:c2',
    {
      ticketKey: 'MOB-1',
      field: 'comment-edit',
      activityId: 'c2',
      text: 'Refused',
      submitted: true,
    },
    'Second thought',
  );
  keepDraft(
    'description:MOB-2',
    { ticketKey: 'MOB-2', field: 'description', text: 'Typed offline in C' },
    '',
  );
  const { client } = renderDrafts();
  await waitFor(() =>
    expect(client.updateTicket).toHaveBeenCalledWith(
      'MOB-2',
      { description: 'Typed offline in C' },
      { description: '' },
    ),
  );
  await waitFor(() => expect(storedDraft('description:MOB-2')).toBeUndefined());
  expect(client.updateComment).toHaveBeenCalledTimes(1);
  expect(client.updateComment).toHaveBeenCalledWith(
    'c2',
    { text: 'Refused' },
    { text: 'Second thought' },
  );
  expect(storedDraft('comment-edit:c2')?.text).toBe('Refused');
});
