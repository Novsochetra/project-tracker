import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';
import { phoneRule } from './phoneCss';

// PT-73's review, iOS Safari (iPhone 17 Pro, iOS 26.3): after any edit of the phone's Assignee
// chip the name was cut until a reload: tap "Claude (lead)", tap Done, and the chip read
// "Claude (le…" ("Dara K" became "Dara…"). The chip was as wide as the name, but the name was the
// field's own text, and iOS keeps room for the suggestions list's button inside the field after
// the list is gone. jsdom can't lay that out, so these check the rules that make it impossible:
// the name shows from a plain copy that sizes the chip, and the field's text only while edited.
// The same review: a tap couldn't place the caret inside the name, because the chip's tap area
// lay over the field, and the field showed two focus rings while edited.

const CHIPS = 'features/ticket/details/DetailChips.module.css';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

function renderChips(assignee: string) {
  const detail = makeTicketDetail(listItem(1, STATUS.progress, 0, { assignee }));
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
  return screen.getByRole('group', { name: 'Details' });
}

// Screen readers get the name from the field; the copy is only seen.
const nameCopy = (field: HTMLElement) => field.closest('label')!.querySelector('.name');

it('shows the whole name from a copy of it after an edit, not from the field', async () => {
  const user = userEvent.setup();
  const chips = renderChips('Claude (lead)');
  const field = within(chips).getByLabelText('Assignee');
  await user.click(field);
  await user.keyboard('{Enter}');
  expect(field).not.toHaveFocus();
  const name = nameCopy(field);
  expect(name).toHaveTextContent(/^Claude \(lead\)$/);
  expect(name).toHaveAttribute('aria-hidden', 'true');
  expect(phoneRule(CHIPS, '.name').get('text-overflow')).toBe('ellipsis');
  expect(phoneRule(CHIPS, '.input').get('color')).toBe('transparent');
  expect(phoneRule(CHIPS, '.field:focus-within .input').get('color')).toBe('#1b1b1f');
  expect(phoneRule(CHIPS, '.field:focus-within .name').get('visibility')).toBe('hidden');
});

it('shows Unassigned from the copy in the placeholder color', () => {
  const chips = renderChips('');
  const name = nameCopy(within(chips).getByLabelText('Assignee'));
  expect(name).toHaveTextContent(/^Unassigned$/);
  expect(name).toHaveClass('unset');
  expect(phoneRule(CHIPS, '.input::placeholder').get('color')).toBe('transparent');
});

it('lets a tap reach the field, above the chip’s tap area', () => {
  expect(phoneRule(CHIPS, '.chip::before').get('position')).toBe('absolute');
  expect(phoneRule(CHIPS, '.input').get('position')).toBe('relative');
});

it('shows one focus ring on the field while it is edited', () => {
  expect(phoneRule(CHIPS, '.chip:has(:focus-visible)').size).toBe(0);
  expect(phoneRule(CHIPS, '.chip:not(.field):has(:focus-visible)').get('outline')).toContain(
    'solid',
  );
});
