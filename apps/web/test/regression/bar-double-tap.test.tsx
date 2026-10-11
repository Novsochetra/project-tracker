import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { PRIMARY_SETTLE_MS } from '../../src/features/ticket/TicketBottomBar';
import { skipAnimations } from '../../src/overlays/testing';
import { advance, stillClock } from './stillClock';

// On a reviewed ticket the phone bar's primary is Move to Done, and Send to Claude takes its place
// once the ticket moves. Two taps 120 ms apart moved the ticket, then the second tap landed on Send
// to Claude and opened the Send to Claude Code sheet.

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
const sheet = () => screen.getByRole('status', { name: 'Sheet' });

it('ignores a second tap that lands on Send to Claude right after Move to Done', async () => {
  const user = userEvent.setup();
  const { client } = renderReviewedTicket();
  cleanups.push(stillClock());
  await user.click(within(bar()).getByRole('button', { name: 'Move to Done' }));
  expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.done });
  const send = await waitFor(() => within(bar()).getByRole('button', { name: 'Send to Claude' }));

  await user.click(send);
  expect(sheet()).toBeEmptyDOMElement();

  await advance(PRIMARY_SETTLE_MS);
  await user.click(send);
  expect(sheet()).toHaveTextContent('"type":"prompt"');
});
