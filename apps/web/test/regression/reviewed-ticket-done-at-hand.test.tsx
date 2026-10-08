import { screen, within } from '@testing-library/react';
import type { Activity } from '@tracker/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// On a phone a reviewed ticket's verdict, stars and summary sat at the bottom of Activity, past
// Details and Delete ticket, while the bottom bar offered "Send to Claude", the wrong next step.
// A ticket sent back with changes requested only said why at the very bottom too.

const reviewed = (verdict: 'approved' | 'changes_requested', text: string): Activity =>
  comment('v1', text, {
    type: 'review',
    actor: { kind: 'agent', name: 'Claude (reviewer)' },
    review: { verdict, rating: verdict === 'approved' ? 4 : 2 },
  });

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function renderPhoneTicket(statusId: string, review: Activity) {
  const detail = makeTicketDetail(listItem(3, statusId, 0), { activity: [review] });
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
  const latest = screen.getByRole('region', { name: 'Latest review' });
  const details = screen.getByRole('complementary', { name: 'Ticket details' });
  const above = (latest.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  const bar = document.querySelector<HTMLElement>('[data-bottom-bar]')!;
  return { latest, above, bar };
}

it('shows a reviewed ticket’s review above the details and makes Move to Done the bar’s primary', () => {
  const { latest, above, bar } = renderPhoneTicket(STATUS.reviewed, reviewed('approved', 'Works.'));
  expect(above).toBe(true);
  expect(latest).toHaveTextContent('Approved');
  expect(within(latest).getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument();
  expect(latest).toHaveTextContent('Works.');
  expect(within(latest).getByRole('button', { name: 'Move to Done' })).toBeInTheDocument();
  expect(within(bar).getByRole('button', { name: 'Move to Done' })).toBeInTheDocument();
  expect(within(bar).queryByRole('button', { name: 'Send to Claude' })).not.toBeInTheDocument();
});

it('shows why a sent-back ticket came back above the details', () => {
  const { latest, above } = renderPhoneTicket(
    STATUS.todo,
    reviewed('changes_requested', 'Add a screenshot test.'),
  );
  expect(above).toBe(true);
  expect(latest).toHaveTextContent('Changes requested');
  expect(latest).toHaveTextContent('Add a screenshot test.');
});
