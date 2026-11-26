import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { PRIMARY_SETTLE_MS } from '../../src/features/ticket/TicketBottomBar';
import { skipAnimations } from '../../src/overlays/testing';
import { advance, stillClock } from './stillClock';

// On a reviewed ticket the phone bar's primary is Move to Done, and another primary takes its place
// once the ticket moves. Two taps 120 ms apart moved the ticket, then the second tap landed on
// that button: Send to Claude opened its sheet. Since PT-274 it is Comment, which would focus the
// comment box and open the keyboard.

const approval = comment('v1', 'Fix is correct.', {
  type: 'review',
  actor: { kind: 'agent', name: 'Claude (reviewer)' },
  review: { verdict: 'approved', rating: 4 },
});

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
  // jsdom has no scrollIntoView; the jump to the comment box scrolls the box into view.
  Element.prototype.scrollIntoView = vi.fn();
  cleanups.push(() => Reflect.deleteProperty(Element.prototype, 'scrollIntoView'));
});

afterEach(() => cleanups.forEach((undo) => undo()));

function renderReviewedTicket() {
  const detail = makeTicketDetail(listItem(3, STATUS.reviewed, 0), { activity: [approval] });
  const rendered = renderTicket({
    detail,
    phone: true,
    client: { updateTicket: vi.fn().mockReturnValue(new Promise(() => undefined)) },
  });
  cleanups.push(rendered.restorePhone);

  return rendered;
}

const bar = () => document.querySelector<HTMLElement>('[data-bottom-bar]')!;
const commentField = () => screen.getByRole('textbox', { name: 'Comment' });

it('ignores a second tap that lands on Comment right after Move to Done', async () => {
  const user = userEvent.setup();
  const { client } = renderReviewedTicket();
  cleanups.push(stillClock());
  await user.click(within(bar()).getByRole('button', { name: 'Move to Done' }));
  expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.done });
  const comment = await waitFor(() =>
    within(bar()).getByRole('button', { name: 'Go to the comment box' }),
  );

  await user.click(comment);
  expect(commentField()).not.toHaveFocus();

  await advance(PRIMARY_SETTLE_MS);
  await user.click(comment);
  expect(commentField()).toHaveFocus();
});
