import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReportPreview } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { makeBoard, project, statuses } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { ReportSheet } from '../../src/features/claude/ReportSheet';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { NewTicketSheet } from '../../src/features/project/NewTicketSheet';
import {
  blankForm,
  hasChanges,
  type NewTicketForm,
} from '../../src/features/project/newTicketForm';
import { draftChanged, draftOf } from '../../src/features/statuses/statusForm';
import { StatusManagerSheet } from '../../src/features/statuses/StatusManagerSheet';

let restore: () => void = () => undefined;

afterEach(() => {
  restore();
});

const touch = { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: 160 };

// The grabber and header take the drag; this is what a finger pulling the sheet down sends.
function swipeDown(dialog: HTMLElement, title: string) {
  const handle = within(dialog).getByText(title);
  fireEvent.pointerDown(handle, { ...touch, clientY: 120 });
  fireEvent.pointerMove(handle, { ...touch, clientY: 260 });
  fireEvent.pointerMove(handle, { ...touch, clientY: 420 });
  fireEvent.pointerUp(handle, { ...touch, clientY: 420 });
}

const confirm = () => screen.queryByRole('dialog', { name: 'Discard changes?' });
// The dimmed area around a sheet is the "Close" button outside its dialog.
const scrimOf = (dialog: HTMLElement) =>
  within(dialog.parentElement!)
    .getAllByRole('button', { name: 'Close' })
    .find((button) => !dialog.contains(button))!;

function NewTicketHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <NewTicketSheet open={open} projectKey="MOB" onClose={() => setOpen(false)} />
    </>
  );
}

async function openNewTicket(isPhone: boolean) {
  restore = sheetTestSetup(isPhone);
  const api = setupApi({
    getBoard: vi.fn().mockResolvedValue(makeBoard()),
    listPeople: vi.fn().mockResolvedValue([]),
  });
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <NewTicketHarness />
      </ToastProvider>
    </Wrapper>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open sheet' }));
  return user;
}

const newTicket = () => screen.getByRole('dialog', { name: 'New ticket' });
const ticketTitle = () => screen.getByLabelText('Ticket title');
const IDEA = 'Half-typed idea about offline mode';

describe('regression: sheets threw typed text away on swipe-down or tap outside', () => {
  it('springs a New ticket sheet with a typed title back from a swipe-down and asks', async () => {
    const user = await openNewTicket(true);
    await user.type(ticketTitle(), IDEA);
    swipeDown(newTicket(), 'New ticket');

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(newTicket()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(ticketTitle()).toHaveValue(IDEA);
  });

  it('asks when the dimmed area is tapped, and Discard leaves the next sheet blank', async () => {
    const user = await openNewTicket(true);
    await user.type(ticketTitle(), IDEA);
    await user.click(scrimOf(newTicket()));
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(ticketTitle()).toHaveValue('');
  });

  it('asks on Escape on desktop', async () => {
    const user = await openNewTicket(false);
    await user.type(screen.getByLabelText('Description'), 'Steps');
    await user.keyboard('{Escape}');
    expect(confirm()).toBeInTheDocument();
    expect(newTicket()).toBeInTheDocument();
  });

  it('still closes an untouched New ticket sheet at once', async () => {
    const user = await openNewTicket(true);
    swipeDown(newTicket(), 'New ticket');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(confirm()).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(newTicket()).toBeInTheDocument();
  });

  it('asks before a Paste report sheet with a pasted report is swiped away', async () => {
    restore = sheetTestSetup(true);
    const preview: ReportPreview = { items: [], matchedCount: 0 };
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <ReportSheet
          open={open}
          onClose={() => setOpen(false)}
          scope={{ kind: 'project', projectKey: 'MOB' }}
        />
      );
    }
    renderWithApi(<Harness />, {
      getProject: vi.fn().mockResolvedValue({ project, statuses }),
      previewReport: vi.fn().mockResolvedValue(preview),
    });
    const user = userEvent.setup();
    const dialog = screen.getByRole('dialog', { name: 'Paste Claude Code report' });
    await user.click(within(dialog).getByRole('textbox', { name: 'Report' }));
    await user.paste('TICKET: MOB-1\nSTATUS: done');
    swipeDown(dialog, 'Paste report');

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(within(dialog).getByRole('textbox', { name: 'Report' })).toHaveValue(
      'TICKET: MOB-1\nSTATUS: done',
    );
  });

  it('asks before Statuses closes over an unsaved status edit, and not after Cancel', async () => {
    restore = sheetTestSetup(true);
    function Harness() {
      const [open, setOpen] = useState(true);
      return <StatusManagerSheet open={open} onClose={() => setOpen(false)} projectKey="MOB" />;
    }
    renderWithApi(<Harness />, { getBoard: vi.fn().mockResolvedValue(makeBoard()) });
    const user = userEvent.setup();
    const dialog = screen.getByRole('dialog', { name: 'Statuses' });
    await user.click(await within(dialog).findByRole('button', { name: /^Reviewed/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Status name' }), ' by QA');

    await user.click(scrimOf(dialog));
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(within(dialog).getByRole('textbox', { name: 'Status name' })).toHaveValue(
      'Reviewed by QA',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(confirm()).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('what counts as unsaved changes', () => {
  it('treats a New ticket form with only blank text and defaults as unchanged', () => {
    const changed = (patch: Partial<NewTicketForm>) =>
      hasChanges({ ...blankForm(), ...patch }, 's-todo');
    expect(changed({})).toBe(false);
    expect(changed({ title: '   ', description: '\n' })).toBe(false);
    expect(changed({ statusId: 's-todo', priority: 'medium' })).toBe(false);
    expect(changed({ title: 'Offline mode' })).toBe(true);
    expect(changed({ assignee: 'Dara' })).toBe(true);
    expect(changed({ priority: 'high' })).toBe(true);
    expect(changed({ due: '2026-10-09' })).toBe(true);
    expect(changed({ statusId: 's-done' })).toBe(true);
  });

  it('compares a status draft with the one the editor opened with', () => {
    const [first] = statuses;
    const initial = draftOf(first!);
    expect(draftChanged(initial, initial)).toBe(false);
    expect(draftChanged(initial, { ...initial, name: ` ${initial.name} ` })).toBe(false);
    expect(draftChanged(initial, { ...initial, color: initial.color.toLowerCase() })).toBe(false);
    expect(draftChanged(initial, { ...initial, name: 'Backlog' })).toBe(true);
    expect(draftChanged(initial, { ...initial, category: 'in_progress' })).toBe(true);
    expect(draftChanged(initial, { ...initial, color: '#12A594' })).toBe(true);
  });
});
