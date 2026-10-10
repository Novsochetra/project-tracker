import { render, screen, within } from '@testing-library/react';
import type { Review, StatusCategory } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { listItem, statuses } from '../../api/test/fixtures';
import type { RowCallbacks } from './rowTypes';
import { TicketRowContent } from './TicketRowContent';

const SENT_BACK: Review = { verdict: 'changes_requested', rating: 2 };
const APPROVED: Review = { verdict: 'approved', rating: 4 };

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  confirmDelete: vi.fn(),
};

function renderRow(category: StatusCategory, lastReview: Review | null, waiting = false) {
  const status = statuses.find((candidate) => candidate.category === category)!;
  const ticket = listItem(3, status.id, 0, {
    title: 'Dark mode colors',
    due: '2026-10-09',
    assignee: 'Claude',
    lastReview,
    waiting,
  });
  render(
    <TicketRowContent ticket={ticket} status={status} dragged={false} callbacks={callbacks} />,
  );
  return screen.getByRole('button', { name: /^MOB-3\b/ });
}

describe('TicketRowContent', () => {
  it.each(['todo', 'in_progress'] as const)(
    'marks a ticket sent back to %s with the Changes requested chip, before the due date',
    (category) => {
      const row = renderRow(category, SENT_BACK);
      expect(row).toHaveAccessibleName('MOB-3 Dark mode colors Changes requested Oct 9 Claude');
      const chip = within(row).getByText('Changes requested').closest('[data-verdict]');
      expect(chip).toHaveAttribute('data-verdict', 'changes_requested');
    },
  );

  it.each(['in_review', 'reviewed', 'done'] as const)(
    'drops the chip once the ticket is in %s',
    (category) => {
      const row = renderRow(category, SENT_BACK);
      expect(row).toHaveAccessibleName('MOB-3 Dark mode colors Oct 9 Claude');
      expect(row.querySelector('[data-verdict]')).toBeNull();
    },
  );

  it('shows no chip for an approval', () => {
    const row = renderRow('todo', APPROVED);
    expect(row).toHaveAccessibleName('MOB-3 Dark mode colors Oct 9 Claude');
    expect(row.querySelector('[data-verdict]')).toBeNull();
  });

  it('shows no chip on a ticket nobody reviewed', () => {
    expect(renderRow('in_progress', null).querySelector('[data-verdict]')).toBeNull();
  });

  it('says Claude waits for the person after the title, and opens the ticket on a tap', () => {
    const row = renderRow('in_progress', null, true);
    expect(row).toHaveAccessibleName(
      'MOB-3 Dark mode colors Claude is waiting for you Oct 9 Claude',
    );
    expect(within(row).getByText('Waiting for you')).toBeVisible();
    row.click();
    expect(callbacks.open).toHaveBeenCalledWith(expect.objectContaining({ key: 'MOB-3' }));
  });

  it('keeps the mark beside a Changes requested chip, before it', () => {
    const row = renderRow('in_progress', SENT_BACK, true);
    expect(row).toHaveAccessibleName(
      'MOB-3 Dark mode colors Claude is waiting for you Changes requested Oct 9 Claude',
    );
  });

  it('shows no mark while Claude waits for nobody', () => {
    expect(renderRow('in_progress', null)).not.toHaveTextContent('Waiting for you');
  });
});
