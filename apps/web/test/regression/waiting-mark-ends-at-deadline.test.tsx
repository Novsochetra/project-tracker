import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, statuses } from '../../src/api/test/fixtures';
import { BoardCardFace } from '../../src/features/project/board/BoardCardFace';
import type { RowCallbacks } from '../../src/features/project/rowTypes';
import { TicketRowContent } from '../../src/features/project/TicketRowContent';

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  confirmDelete: vi.fn(),
};
const status = statuses.find((candidate) => candidate.category === 'in_progress')!;
const ANSWER_WITHIN_MS = 60_000;

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

// A helper that was killed or went offline sends no event when its request runs out, and the
// tracker ends requests lazily, so the board read before the deadline still says Claude waits
// (PT-168 review).
describe('regression: the waiting mark at the request deadline', () => {
  it.each([
    ['row', TicketRowContent],
    ['card', BoardCardFace],
  ] as const)('goes from the %s when the request runs out', (_, Face) => {
    const ticket = listItem(3, status.id, 0, { waitingUntil: Date.now() + ANSWER_WITHIN_MS });
    render(<Face ticket={ticket} status={status} dragged={false} callbacks={callbacks} />);
    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(ANSWER_WITHIN_MS - 1);
    });
    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Waiting for you')).toBeNull();
  });
});
