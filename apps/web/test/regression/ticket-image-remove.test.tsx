import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

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
  await user.click(within(sheet).getByRole('button', { name: 'Remove image' }));
  expect(client.deleteAttachment).toHaveBeenCalledWith('a');
});
