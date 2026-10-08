import { screen, within } from '@testing-library/react';
import type { Activity } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 62 (PT-91): activity rows were keyed by their id, so entries the tracker sent without
// one (or with a null one) logged React's key warning, and React could mix up their rows.

const NOW = Date.now();

function withoutId(text: string, createdAt: number): Activity {
  const { id: _id, ...rest } = comment('x', text, { type: 'event', createdAt });
  return rest as Activity;
}

const activity = (): Activity[] => [
  withoutId('first without an id', NOW - 40_000),
  { ...comment('x', 'null id one', { type: 'event', createdAt: NOW - 30_000 }), id: null } as never,
  { ...comment('x', 'null id two', { type: 'event', createdAt: NOW - 20_000 }), id: null } as never,
  withoutId('second without an id', NOW - 10_000),
  comment('c1', 'A comment with an id', { createdAt: NOW }),
];

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

const keyWarnings = () =>
  consoleError.mock.calls
    .map((call) => call.map(String).join(' '))
    .filter((line) => /same key|unique "key"/.test(line));

it('shows activity rows without an id without a key warning', () => {
  const rendered = renderTicket({ detail: makeTicketDetail(undefined, { activity: activity() }) });
  cleanups.push(rendered.restorePhone);
  const log = screen.getByRole('region', { name: 'Activity' });
  for (const text of ['first without an id', 'null id one', 'null id two', 'second without an id'])
    expect(within(log).getByText(text, { exact: false })).toBeInTheDocument();
  expect(within(log).getByText('A comment with an id')).toBeInTheDocument();
  expect(keyWarnings()).toEqual([]);
});
