import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// On a phone the ticket screen stacked the title and description, then the Details card (Status,
// Priority, Assignee, Due date), the Project, Created and Updated card and Delete ticket, then
// Activity. With a description of a few lines and a file, Details sat in the middle of the page
// (PT-73, iPhone 16e): to change the status the user scrolled to find it, and with long comments
// the comment box was far below it.

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

function renderPhoneTicket() {
  const item = listItem(3, STATUS.progress, 0, {
    description: 'Open the screen, rotate the phone twice and check the avatar.',
    assignee: 'Dara',
    due: '2026-10-09',
    createdAt: new Date(2026, 9, 2, 12).getTime(),
  });
  const detail = makeTicketDetail(item, { activity: [comment('c1', 'Looks good to me.')] });
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
}

const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

it('puts Status, Priority, Assignee and Due date right under the title, above the description', () => {
  renderPhoneTicket();
  const title = screen.getByLabelText('Title');
  const description = screen.getByLabelText('Description');
  const details = screen.getByRole('group', { name: 'Details' });
  expect(follows(title, details)).toBe(true);
  expect(follows(details, description)).toBe(true);
  expect(within(details).getByRole('button', { name: /^Status/ })).toHaveTextContent('In progress');
  expect(within(details).getByRole('button', { name: /^Priority/ })).toHaveTextContent('Medium');
  expect(within(details).getByLabelText('Assignee')).toHaveValue('Dara');
  expect(within(details).getByLabelText('Due date')).toHaveValue('2026-10-09');
});

it('leaves no Details card between the description and Activity', () => {
  renderPhoneTicket();
  expect(screen.queryByRole('complementary', { name: 'Ticket details' })).not.toBeInTheDocument();
  expect(screen.queryByText('Details', { selector: 'span' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Status/ })).toHaveLength(1);
  expect(screen.getAllByLabelText('Assignee')).toHaveLength(1);
});

it('moves the project, dates and Delete ticket to the end, after the comment box', () => {
  renderPhoneTicket();
  const box = screen.getByLabelText('Comment');
  const info = screen.getByText(/Created Oct 2, 2026/).closest('p')!;
  expect(follows(box, info)).toBe(true);
  expect(info).toHaveTextContent('Mobile app');
  expect(follows(box, screen.getByRole('button', { name: 'Delete ticket' }))).toBe(true);
});
