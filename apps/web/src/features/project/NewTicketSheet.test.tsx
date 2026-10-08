import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../api';
import { listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { setupApi } from '../../api/test/render';
import { ToastProvider } from '../../components';
import { sheetDraft } from '../../lib/sheetDrafts';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { getListView, resetListView, setListFilter, setListQuery } from './listViewStore';
import { NewTicketSheet } from './NewTicketSheet';

const {
  commentCount: _c,
  attachmentCount: _a,
  ...created
} = listItem(5, STATUS.todo, -1000, {
  title: 'Crash on rotate',
});

interface HarnessProps {
  statusId?: string;
  onClose?: () => void;
}

// Like SheetsProvider, each opening mounts a new sheet.
function Harness({ statusId, onClose = () => undefined }: HarnessProps) {
  const [open, setOpen] = useState(true);
  const [opening, setOpening] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setOpening((count) => count + 1);
        }}
      >
        Open sheet
      </button>
      <NewTicketSheet
        key={opening}
        open={open}
        projectKey="MOB"
        statusId={statusId}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      />
    </>
  );
}

function renderSheet(props: HarnessProps = {}, createTicket = vi.fn().mockResolvedValue(created)) {
  const api = setupApi({
    createTicket,
    getBoard: vi.fn().mockResolvedValue(makeBoard()),
    listPeople: vi.fn().mockResolvedValue(['Dara', 'Sophea']),
  });
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <Harness {...props} />
      </ToastProvider>
    </Wrapper>,
  );
  return { ...api, createTicket, user: userEvent.setup() };
}

const dialog = () => screen.getByRole('dialog', { name: 'New ticket' });
const titleField = () => screen.getByLabelText('Ticket title');
const createButton = () => within(dialog()).getByRole('button', { name: 'Create' });

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  localStorage.clear();
});

describe('NewTicketSheet', () => {
  it('opens for the project with the group status and Medium priority', () => {
    renderSheet({ statusId: STATUS.progress });
    expect(dialog()).toHaveTextContent('Mobile app');
    expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('In progress');
    expect(screen.getByRole('button', { name: /^Priority/ })).toHaveTextContent('Medium');
    expect(createButton()).toBeDisabled();
    expect(titleField()).toHaveFocus();
  });

  it('defaults to the first status and leaves focus alone on phones', () => {
    restore.push(mockPhone(true));
    renderSheet();
    expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('To do');
    expect(titleField()).not.toHaveFocus();
  });

  it('asks for a title when Enter is pressed without one', async () => {
    const { user, createTicket } = renderSheet();
    await user.type(titleField(), '   {Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Add a title to create the ticket.');
    expect(createTicket).not.toHaveBeenCalled();
    await user.type(titleField(), 'A');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('creates the ticket with the chosen fields, confirms and closes', async () => {
    const onClose = vi.fn();
    const { user, createTicket } = renderSheet({ onClose });
    await user.type(titleField(), ' Crash on rotate ');
    await user.type(screen.getByLabelText('Description'), 'Rotate twice.');
    await user.click(screen.getByRole('button', { name: /^Priority/ }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    await user.type(screen.getByLabelText('Assignee'), 'Dara');
    await user.click(createButton());

    expect(createTicket).toHaveBeenCalledWith('MOB', {
      title: 'Crash on rotate',
      description: 'Rotate twice.',
      priority: 'high',
      assignee: 'Dara',
      due: '',
      statusId: STATUS.todo,
    });
    expect(await screen.findByText('MOB-5 created')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('creates on Enter in the title', async () => {
    const { user, createTicket } = renderSheet({ statusId: STATUS.review });
    await user.type(titleField(), 'Cache avatars{Enter}');
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ title: 'Cache avatars', statusId: STATUS.review }),
    );
  });

  it('wraps the title but keeps it one line of text, as long as the API takes', async () => {
    const { user, createTicket } = renderSheet();
    expect(titleField()).toBeInstanceOf(HTMLTextAreaElement);
    expect(titleField()).toHaveAttribute('maxlength', '300');
    await user.click(titleField());
    await user.paste('Crash on rotate\nin landscape');
    expect(titleField()).toHaveValue('Crash on rotate in landscape');
    await user.keyboard('{Enter}');
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ title: 'Crash on rotate in landscape' }),
    );
  });

  it('creates once when Enter is pressed twice before the server answers', async () => {
    const { user, createTicket } = renderSheet();
    await user.type(titleField(), 'Only once');
    fireEvent.keyDown(titleField(), { key: 'Enter' });
    fireEvent.keyDown(titleField(), { key: 'Enter' });
    expect(await screen.findByText('MOB-5 created')).toBeInTheDocument();
    expect(createTicket).toHaveBeenCalledTimes(1);
  });

  it('uses the status picked in the sheet', async () => {
    const { user, createTicket } = renderSheet();
    await user.click(screen.getByRole('button', { name: /^Status/ }));
    await user.click(screen.getByRole('option', { name: 'Done' }));
    await user.type(titleField(), 'Ship it{Enter}');
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ statusId: STATUS.done }),
    );
  });

  it('switches back to All when the status tab would hide the new ticket', async () => {
    setListFilter('MOB', STATUS.done);
    const { user } = renderSheet();
    await user.type(titleField(), 'New idea{Enter}');
    await waitFor(() => expect(getListView('MOB')).toEqual({ filter: 'all', query: '' }));
  });

  it('clears an active search so the new ticket shows', async () => {
    setListFilter('MOB', STATUS.todo);
    setListQuery('MOB', 'login');
    const { user } = renderSheet();
    await user.type(titleField(), 'New idea{Enter}');
    await waitFor(() => expect(getListView('MOB')).toEqual({ filter: 'all', query: '' }));
  });

  it("keeps the tab of the new ticket's status", async () => {
    setListFilter('MOB', STATUS.todo);
    const { user } = renderSheet();
    await user.type(titleField(), 'New idea{Enter}');
    expect(await screen.findByText('MOB-5 created')).toBeInTheDocument();
    expect(getListView('MOB').filter).toBe(STATUS.todo);
  });

  it('shows the server error and stays open', async () => {
    const onClose = vi.fn();
    const failing = vi.fn().mockRejectedValue(new ApiError(400, 'invalid_input', 'Too long.'));
    const { user } = renderSheet({ onClose }, failing);
    await user.type(titleField(), 'Too long{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too long.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('starts blank every time it opens', async () => {
    const { user } = renderSheet();
    await user.type(titleField(), 'Draft');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sheetDraft('new-ticket:MOB')).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(titleField()).toHaveValue('');
  });

  it('opens with the fields typed before the page went away', async () => {
    const first = renderSheet({ statusId: STATUS.progress });
    await first.user.type(titleField(), 'Half an idea');
    await first.user.click(screen.getByRole('button', { name: /^Status/ }));
    await first.user.click(screen.getByRole('option', { name: 'Done' }));
    cleanup();

    renderSheet({ statusId: STATUS.progress });
    expect(titleField()).toHaveValue('Half an idea');
    expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('Done');
    expect(createButton()).toBeEnabled();
    expect(titleField()).toHaveFocus();
    expect((titleField() as HTMLTextAreaElement).selectionStart).toBe('Half an idea'.length);
  });

  it('lets the kept fields go once they are emptied or the ticket is created', async () => {
    const { user } = renderSheet();
    await user.type(titleField(), 'Typo');
    expect(sheetDraft('new-ticket:MOB')).toMatchObject({ title: 'Typo' });
    await user.clear(titleField());
    expect(sheetDraft('new-ticket:MOB')).toBeUndefined();
    await user.type(titleField(), 'Cache avatars{Enter}');
    expect(await screen.findByText('MOB-5 created')).toBeInTheDocument();
    expect(sheetDraft('new-ticket:MOB')).toBeUndefined();
  });
});
