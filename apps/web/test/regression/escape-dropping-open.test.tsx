import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachment, comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Fresh modules whose viewer code never arrives, as on a network too slow for it. Released code
// would still be loading for the next test's tap.
async function renderTicketWithCodeOnItsWay() {
  vi.resetModules();
  vi.doMock('../../src/features/attachments/viewers', () => new Promise(() => undefined));
  const { renderTicket } = await import('../../src/features/ticket/test/renderTicket');
  const rendered = renderTicket({
    detail: makeTicketDetail(undefined, {
      attachments: [attachment('a'), attachment('b')],
      activity: [comment('c1', 'First thought')],
    }),
  });
  cleanups.push(rendered.restorePhone);
  return userEvent.setup();
}

// A tap focuses no button on iOS, so the field or button that had focus keeps it.
const tapTile = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

const opening = () => screen.queryByText('Opening');

// On an iPad with a keyboard, the Escape that dropped a viewer still on its way (PT-107) also
// cancelled the comment edit that kept focus through the tap (PT-114).
it('keeps a comment edit open when its Escape drops a viewer on its way', async () => {
  const user = await renderTicketWithCodeOnItsWay();
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ' more');
  tapTile('Open image 1');
  expect(opening()).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(opening()).not.toBeInTheDocument();
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought more');
  expect(screen.getByLabelText('Edit comment')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument();
});

// The same Escape also closed the remove-file confirm whose Cancel kept focus (PT-114).
it('keeps the remove-file confirm when its Escape drops a viewer on its way', async () => {
  const user = await renderTicketWithCodeOnItsWay();
  await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
  // A person reads the confirm; the grid ignores a double-click's second click (PT-83).
  await new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));
  tapTile('Open image 1');
  expect(opening()).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(opening()).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent("Remove image 2? This can't be undone.");
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
