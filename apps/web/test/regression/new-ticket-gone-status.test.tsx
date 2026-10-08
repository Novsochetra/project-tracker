import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { makeBoard } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { NewTicketSheet } from '../../src/features/project/NewTicketSheet';
import { keepSheetDraft, sheetDraft } from '../../src/lib/sheetDrafts';

// New ticket kept a picked status that was deleted before the sheet opened again. The sheet showed
// the default status and nothing typed, yet it counted as changed: Cancel asked "Discard
// changes?", and the stale entry stayed stored (PT-11 review).

const DRAFT_ID = 'new-ticket:MOB';

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
  localStorage.clear();
});

function openNewTicket(onClose: () => void) {
  const api = setupApi({
    getBoard: vi.fn().mockResolvedValue(makeBoard()),
    listPeople: vi.fn().mockResolvedValue([]),
  });
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <NewTicketSheet open projectKey="MOB" onClose={onClose} />
      </ToastProvider>
    </Wrapper>,
  );
  return userEvent.setup();
}

describe('regression: a kept status that was deleted leaves the sheet unchanged', () => {
  it('closes at once and lets the stale entry go', async () => {
    keepSheetDraft(DRAFT_ID, { title: '', statusId: 'deleted-status', priority: 'medium' });
    const onClose = vi.fn();
    const user = openNewTicket(onClose);
    const sheet = screen.getByRole('dialog', { name: 'New ticket' });
    expect(within(sheet).getByRole('button', { name: /^Status/ })).toHaveTextContent('To do');

    await waitFor(() => expect(sheetDraft(DRAFT_ID)).toBeUndefined());
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
