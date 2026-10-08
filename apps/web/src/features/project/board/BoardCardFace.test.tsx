import { render, screen } from '@testing-library/react';
import type { Review, StatusCategory } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { listItem, statuses } from '../../../api/test/fixtures';
import { BoardCardFace } from './BoardCardFace';

const SENT_BACK: Review = { verdict: 'changes_requested', rating: 2 };
const APPROVED: Review = { verdict: 'approved', rating: 4 };

function renderCard(category: StatusCategory, lastReview: Review | null, due = '2026-10-09') {
  const status = statuses.find((candidate) => candidate.category === category)!;
  const ticket = listItem(3, status.id, 0, { title: 'Dark mode colors', due, lastReview });
  render(
    <button type="button">
      <BoardCardFace ticket={ticket} status={status} />
    </button>,
  );
  return screen.getByRole('button', { name: /^MOB-3\b/ });
}

describe('BoardCardFace', () => {
  it.each(['todo', 'in_progress'] as const)(
    'marks a ticket sent back to %s with the Changes requested chip beside the due date',
    (category) => {
      const card = renderCard(category, SENT_BACK);
      expect(card).toHaveAccessibleName(
        'MOB-3 Dark mode colors Changes requested Oct 9 Unassigned',
      );
      const chip = card.querySelector('[data-verdict]');
      expect(chip).toHaveAttribute('data-verdict', 'changes_requested');
      expect(chip?.parentElement).toBe(screen.getByText('Oct 9').closest('span')?.parentElement);
    },
  );

  it('shows the chip without a due date', () => {
    expect(renderCard('todo', SENT_BACK, '')).toHaveAccessibleName(
      'MOB-3 Dark mode colors Changes requested Unassigned',
    );
  });

  it.each(['in_review', 'reviewed', 'done'] as const)(
    'drops the chip once the ticket is in %s',
    (category) => {
      const card = renderCard(category, SENT_BACK);
      expect(card).toHaveAccessibleName('MOB-3 Dark mode colors Oct 9 Unassigned');
      expect(card.querySelector('[data-verdict]')).toBeNull();
    },
  );

  it('shows no chip for an approval', () => {
    const card = renderCard('todo', APPROVED);
    expect(card).toHaveAccessibleName('MOB-3 Dark mode colors Oct 9 Unassigned');
    expect(card.querySelector('[data-verdict]')).toBeNull();
  });

  it('shows no chip on a ticket nobody reviewed', () => {
    expect(renderCard('in_progress', null).querySelector('[data-verdict]')).toBeNull();
  });
});
