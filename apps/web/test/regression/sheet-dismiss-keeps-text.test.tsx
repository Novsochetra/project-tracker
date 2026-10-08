import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  CreateProjectInput,
  Project,
  ProjectSummary,
  ReportPreview,
  UpdateProjectInput,
} from '@tracker/shared';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { deferred } from '../../src/api/test/deferred';
import { makeBoard, otherProject, project, statuses } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import type { SheetRequest } from '../../src/app/sheets/types';
import {
  currentPath,
  projectSummary,
  renderWithApp,
  type HarnessOptions,
} from '../../src/app/test/harness';
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
  // The New ticket sheet keeps typed text in storage until it is created or discarded.
  localStorage.clear();
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

function SheetOpener({ request }: { request: SheetRequest }) {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open(request)}>
      Open sheet
    </button>
  );
}

const website = projectSummary({ ...otherProject, description: 'Docs', repo: '~/code/web' });
const NEW_PROJECT: SheetRequest = { type: 'newProject' };
const EDIT_WEBSITE: SheetRequest = { type: 'editProject', projectKey: 'WEB' };

// Through SheetsProvider, as in the app, so every opening starts a fresh form.
async function openProjectSheet(
  isPhone: boolean,
  request: SheetRequest,
  options: HarnessOptions = { projects: [website] },
) {
  restore = sheetTestSetup(isPhone);
  renderWithApp(
    <SheetsProvider>
      <SheetOpener request={request} />
    </SheetsProvider>,
    options,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open sheet' }));
  return user;
}

const projectSheet = () => screen.getByRole('dialog', { name: /^(New|Edit) project$/ });
const projectName = () => screen.getByLabelText('Project name');
const sheetClosed = () =>
  waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

describe('regression: New project and Edit project threw typed text away', () => {
  it('springs New project back from a swipe-down; Keep editing keeps the name and focus', async () => {
    const user = await openProjectSheet(true, NEW_PROJECT);
    await user.type(projectName(), 'Garden planner');
    swipeDown(projectSheet(), 'New project');

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(projectSheet()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(projectName()).toHaveValue('Garden planner');
    expect(projectName()).toHaveFocus();
  });

  it('asks on a phone tap outside or on Cancel, and Discard opens a blank form next time', async () => {
    const user = await openProjectSheet(true, NEW_PROJECT);
    await user.type(screen.getByLabelText('Repository or folder'), '~/code/garden');
    await user.click(scrimOf(projectSheet()));
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());

    await user.click(within(projectSheet()).getByRole('button', { name: 'Cancel' }));
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await sheetClosed();
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(screen.getByLabelText('Repository or folder')).toHaveValue('');
  });

  it('asks on Escape and a click outside on desktop, where Cancel closes at once', async () => {
    const user = await openProjectSheet(false, NEW_PROJECT);
    await user.type(projectName(), 'Garden planner');
    await user.keyboard('{Escape}');
    expect(confirm()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(projectName()).toHaveFocus();

    await user.click(scrimOf(projectSheet()));
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());

    await user.click(within(projectSheet()).getByRole('button', { name: 'Cancel' }));
    expect(confirm()).not.toBeInTheDocument();
    await sheetClosed();
  });

  it('closes an untouched New project at once, and Create never asks', async () => {
    const createProject = vi.fn((input: CreateProjectInput) =>
      Promise.resolve({
        project: { ...project, name: input.name, key: input.key ?? 'PRJ' },
        statuses,
      }),
    );
    const user = await openProjectSheet(true, NEW_PROJECT, { client: { createProject } });
    swipeDown(projectSheet(), 'New project');
    await sheetClosed();
    expect(confirm()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    await user.type(projectName(), 'Garden planner');
    await user.click(within(projectSheet()).getByRole('button', { name: 'Create' }));
    await sheetClosed();
    expect(confirm()).not.toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/p/GP'));
  });

  it('springs Edit project back from a swipe-down over a rename', async () => {
    const user = await openProjectSheet(true, EDIT_WEBSITE);
    await user.clear(projectName());
    await user.type(projectName(), 'Marketing site');
    swipeDown(projectSheet(), 'Edit project');

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(projectName()).toHaveValue('Marketing site');
  });

  it('asks on Escape over an edit on desktop, and Discard leaves the project as it was', async () => {
    const user = await openProjectSheet(false, EDIT_WEBSITE);
    await user.type(screen.getByLabelText('Description'), ' and blog');
    await user.keyboard('{Escape}');
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await sheetClosed();

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(screen.getByLabelText('Description')).toHaveValue('Docs');
  });

  it('closes an unchanged Edit project at once, also when the project loads after it opened', async () => {
    const projects = deferred<ProjectSummary[]>();
    const user = await openProjectSheet(false, EDIT_WEBSITE, {
      client: { listProjects: () => projects.promise },
    });
    expect(projectName()).toHaveValue('');
    projects.resolve([website]);
    await waitFor(() => expect(projectName()).toHaveValue('Website'));

    await user.keyboard('{Escape}');
    await sheetClosed();
    expect(confirm()).not.toBeInTheDocument();
  });

  it('saves a rename without asking', async () => {
    const updateProject = vi.fn((key: string, input: UpdateProjectInput) =>
      Promise.resolve<Project>({ ...otherProject, ...input, key }),
    );
    const user = await openProjectSheet(true, EDIT_WEBSITE, {
      projects: [website],
      client: { updateProject },
    });
    await user.clear(projectName());
    await user.type(projectName(), 'Marketing site');
    await user.click(within(projectSheet()).getByRole('button', { name: 'Save' }));
    await sheetClosed();
    expect(confirm()).not.toBeInTheDocument();
    expect(updateProject).toHaveBeenCalledWith('WEB', {
      name: 'Marketing site',
      description: 'Docs',
      repo: '~/code/web',
    });
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
