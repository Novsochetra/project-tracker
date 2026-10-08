import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { readActionSheet, skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup(phone: boolean) {
  const deleteAttachment = vi.fn().mockResolvedValue(undefined);
  const rendered = renderTicket({
    phone,
    detail: makeTicketDetail(undefined, { attachments: [attachment('a'), attachment('b')] }),
    client: { deleteAttachment },
  });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

// The x deleted a saved ticket image at once, unlike every other delete in the app.
it('asks before removing a saved ticket image', async () => {
  const user = userEvent.setup();
  const { client } = setup(false);
  await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
  expect(screen.getByRole('alert')).toHaveTextContent("Remove image 2? This can't be undone.");
  // A person reads the confirm; the grid ignores a double-click's second click (PT-83).
  await new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(client.deleteAttachment).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Remove image 2' })).toHaveFocus();

  await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
  await user.click(screen.getByRole('button', { name: 'Remove' }));
  expect(client.deleteAttachment).toHaveBeenCalledWith('b');
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(1),
  );
});

it('asks with an action sheet on phones', async () => {
  const user = userEvent.setup();
  const { client } = setup(true);
  await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
  const sheet = screen.getByRole('dialog', { name: 'Remove image' });
  expect(sheet).toHaveTextContent("Remove image 1? This can't be undone.");
  expect(client.deleteAttachment).not.toHaveBeenCalled();
  await readActionSheet();
  await user.click(within(sheet).getByRole('button', { name: 'Remove image' }));
  expect(client.deleteAttachment).toHaveBeenCalledWith('a');
});

// Safari doesn't focus a tapped button, so the sheet and Cancel handed focus back to whatever
// had it before the tap (here the description) instead of the x.
it('gives focus back to the x when the phone sheet is cancelled after a tap', async () => {
  setup(true);
  screen.getByLabelText('Description').focus();
  fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }));
  const sheet = screen.getByRole('dialog', { name: 'Remove image' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByRole('button', { name: 'Remove image 1' })).toHaveFocus();
});

// Escape closed every other confirm and sheet, but not the desktop remove-image card.
it('closes the desktop confirm with Escape and gives focus back to the x', async () => {
  const user = userEvent.setup();
  const { client } = setup(false);
  await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
  expect(screen.getByRole('alert')).toHaveTextContent("Remove image 2? This can't be undone.");
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove image 2' })).toHaveFocus();
  expect(client.deleteAttachment).not.toHaveBeenCalled();
});
