import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { skipAnimations } from '../../src/overlays/testing';
import { advance, stillClock } from './stillClock';

// The Latest review card left as soon as its Move to Done was tapped, so the second tap of a
// double tap, 150 ms later, landed on what moved up into its place: Add images, which opened the
// photo picker, or the description, which opened the keyboard (WebKit, 375×812). While a double
// tap can still land, the card stays where it was and takes no taps.
// Since PT-73 phones move to Done from the bottom bar only, so the card's button is desktop's,
// where the second click of a double-click lands the same way.

const approval = comment('v1', 'Fix is correct.', {
  type: 'review',
  actor: { kind: 'agent', name: 'Claude (reviewer)' },
  review: { verdict: 'approved', rating: 4 },
});

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.reverse().forEach((undo) => undo()));

function renderReviewedTicket(
  updateTicket = vi.fn().mockReturnValue(new Promise(() => undefined)),
) {
  const detail = makeTicketDetail(listItem(3, STATUS.reviewed, 0), { activity: [approval] });
  const rendered = renderTicket({ detail, client: { updateTicket } });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const latest = () => screen.queryByRole('region', { name: 'Latest review' });
const cardButton = () => within(latest()!).getByRole('button', { name: 'Move to Done' });

it('keeps the card in place, taking no taps, while the second tap of a double tap can land', async () => {
  const user = userEvent.setup();
  const { client } = renderReviewedTicket();
  const button = cardButton();
  cleanups.push(stillClock());
  await user.click(button);
  await advance(150);
  expect(latest()).toBeInTheDocument();
  expect(latest()).toHaveAttribute('inert');
  expect(client.updateTicket).toHaveBeenCalledExactlyOnceWith('MOB-3', { statusId: STATUS.done });
  expect(await screen.findByText('MOB-3 moved to Done')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('Done');

  await advance(CLICK_SHIELD_MS);
  expect(latest()).not.toBeInTheDocument();
});

it('takes taps again when the move fails', async () => {
  const user = userEvent.setup();
  const updateTicket = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  renderReviewedTicket(updateTicket);
  await user.click(cardButton());
  expect(
    await screen.findByText("Can't reach the tracker. Check your connection."),
  ).toBeInTheDocument();

  await waitFor(() => expect(latest()).not.toHaveAttribute('inert'));
  await user.click(cardButton());
  expect(updateTicket).toHaveBeenCalledTimes(2);
});
