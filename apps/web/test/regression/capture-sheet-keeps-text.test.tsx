import type { Ticket } from '@tracker/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachment, listItem, STATUS } from '../../src/api/test/fixtures';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp, type HarnessOptions } from '../../src/app/test/harness';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Quick capture closed on a swipe-down, a tap on the dimmed area, Escape or a click outside, and
// the typed idea was gone; the other sheets with input already asked first (PT-24).

const touch = { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: 160 };

// The grabber and header take the drag; this is what a finger pulling the sheet down sends.
function swipeDown(dialog: HTMLElement) {
  const handle = within(dialog).getByText('New ticket');
  fireEvent.pointerDown(handle, { ...touch, clientY: 120 });
  fireEvent.pointerMove(handle, { ...touch, clientY: 260 });
  fireEvent.pointerMove(handle, { ...touch, clientY: 420 });
  fireEvent.pointerUp(handle, { ...touch, clientY: 420 });
}

// The dimmed area around a sheet is the "Close" button outside its dialog.
const scrimOf = (dialog: HTMLElement) =>
  within(dialog.parentElement!)
    .getAllByRole('button', { name: 'Close' })
    .find((button) => !dialog.contains(button))!;

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'capture' })}>
      Capture
    </button>
  );
}

const ticket = (title: string): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    ...rest
  } = listItem(7, STATUS.todo, 0, {
    key: 'MOB-7',
    title,
  });
  return rest;
};

let restore: Array<() => void> = [];

afterEach(() => {
  restore.forEach((undo) => undo());
  restore = [];
  window.localStorage.clear();
});

async function openCapture(isPhone: boolean, client: HarnessOptions['client'] = {}) {
  restore = [skipAnimations(), mockPhone(isPhone)];
  renderWithApp(
    <SheetsProvider>
      <Opener />
    </SheetsProvider>,
    {
      projects: [projectSummary()],
      client: {
        createTicket: vi.fn((_key: string, input: { title: string }) =>
          Promise.resolve(ticket(input.title)),
        ),
        ...client,
      },
    },
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Capture' }));
  return user;
}

const capture = () => screen.getByRole('dialog', { name: 'New ticket' });
const titleField = () => within(capture()).getByLabelText('Ticket title');
const asking = () => screen.queryByRole('dialog', { name: 'Discard changes?' });
const closed = () =>
  waitFor(() => expect(screen.queryByRole('dialog', { name: 'New ticket' })).toBeNull());
const IDEA = 'Half-typed idea from the bus';

describe('regression: quick capture threw typed text away on a swipe or a tap outside', () => {
  it('springs back from a swipe-down with a typed title and asks first', async () => {
    const user = await openCapture(true);
    await user.type(titleField(), IDEA);
    swipeDown(capture());

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(asking()).not.toBeInTheDocument());
    expect(titleField()).toHaveValue(IDEA);
  });

  it('asks when the dimmed area is tapped or Cancel is tapped, and Discard closes it', async () => {
    const user = await openCapture(true);
    await user.type(within(capture()).getByLabelText('Description'), 'Steps');
    await user.click(scrimOf(capture()));
    expect(asking()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(asking()).not.toBeInTheDocument());

    await user.click(within(capture()).getByRole('button', { name: 'Cancel' }));
    expect(asking()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await closed();
  });

  it('asks on Escape and on a click outside on desktop', async () => {
    const user = await openCapture(false);
    await user.type(titleField(), IDEA);
    await user.keyboard('{Escape}');
    expect(asking()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(asking()).not.toBeInTheDocument());

    await user.click(scrimOf(capture()));
    expect(asking()).toBeInTheDocument();
    expect(titleField()).toHaveValue(IDEA);
  });

  it('counts an added photo as something to lose', async () => {
    const user = await openCapture(true, {
      uploadAttachment: vi.fn().mockResolvedValue(attachment('shot', { ticketId: null })),
      deleteAttachment: vi.fn(),
    });
    const photo = new File(['png'], 'shot.png', { type: 'image/png' });
    await user.upload(within(capture()).getByLabelText('Add files to ticket'), photo);
    expect(await within(capture()).findByRole('img', { name: 'Image 1' })).toBeVisible();
    swipeDown(capture());

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });

  it('closes an empty capture at once', async () => {
    const user = await openCapture(true);
    swipeDown(capture());
    await closed();
    expect(asking()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await user.keyboard('{Escape}');
    await closed();
  });

  it('closes without asking once Create has the ticket', async () => {
    const user = await openCapture(true);
    await user.type(titleField(), IDEA);
    await user.click(within(capture()).getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('MOB-7 created')).toBeInTheDocument();
    await closed();
    expect(asking()).not.toBeInTheDocument();
  });
});
