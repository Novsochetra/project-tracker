import { screen, within } from '@testing-library/react';
import type { Activity } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderScreen } from '../../src/app/renderScreen';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 44 (PT-71): an activity array with a null entry still failed the whole Ticket screen,
// because the list of items is built outside the per-item error boundaries.

const CLAUDE = { kind: 'agent', name: 'Claude' } as const;

let cleanups: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  consoleError.mockRestore();
});

const withGaps = (): Activity[] =>
  [
    comment('c1', 'Before the gap', { createdAt: Date.now() - 120_000 }),
    null,
    comment('r1', 'SUMMARY: Done.', {
      type: 'report',
      actor: CLAUDE,
      createdAt: Date.now() - 60_000,
    }),
    7,
    'text',
    comment('c2', 'After the gap', { createdAt: Date.now() }),
  ] as unknown as Activity[];

it.each([
  ['a desktop', false],
  ['a phone', true],
])('shows the rest of the activity around entries it cannot read on %s', (_, phone) => {
  const rendered = renderTicket({
    detail: makeTicketDetail(listItem(1, STATUS.todo, 0), { activity: withGaps() }),
    phone,
    children: renderScreen({ name: 'ticket', key: 'MOB', num: 1 }),
  });
  cleanups.push(rendered.restorePhone);
  expect(screen.queryByText('Something went wrong')).toBeNull();
  const log = screen.getByRole('region', { name: 'Activity' });
  expect(within(log).getByText('Before the gap')).toBeInTheDocument();
  expect(within(log).getByText('Done.')).toBeInTheDocument();
  expect(within(log).getByText('After the gap')).toBeInTheDocument();
  expect(within(log).queryByText("Couldn't show this item")).toBeNull();
  if (!phone) expect(screen.getByText(/^Last report/)).toBeInTheDocument();
});
