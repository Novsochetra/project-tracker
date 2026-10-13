import { screen, within } from '@testing-library/react';
import type { ChainStop } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { makeRun } from '../../src/api/test/runFixtures';
import { shownRun } from '../../src/features/claude/runs';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// PT-220: a tracker newer than the open page can send a chain stop the page has no words for;
// looking one up threw and took the ticket screen down with it.
const unknown = makeRun({
  role: 'review',
  status: 'done',
  endedAt: Date.now() - 60_000,
  chainStop: 'paused' as ChainStop,
});

it('reads an unknown chain stop as the plain line', () => {
  expect(shownRun([unknown], Date.now())).toMatchObject({
    state: 'stopped',
    text: 'Automatic review stopped.',
  });
});

it('shows the run card with the plain line and Try again', async () => {
  const detail = makeTicketDetail(listItem(1, STATUS.progress, 0));
  const rendered = renderTicket({
    detail,
    client: { listTicketRuns: vi.fn().mockResolvedValue([unknown]) },
  });
  cleanups.push(rendered.restorePhone);
  const card = await screen.findByRole('region', { name: 'Claude Code run' });

  expect(card).toHaveTextContent('Automatic review stopped.');
  expect(within(card).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
