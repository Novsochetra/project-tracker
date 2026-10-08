import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Activity } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { attachment, comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { activityItems } from '../../src/features/ticket/activity/activityItems';
import { firstRise } from '../../src/features/ticket/activity/risePlan';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 65 (PT-93): rows and file tiles were keyed by their id, so two activity entries with
// the same id, a ticket file the tracker sent twice, or a real id that matched the key given to a
// row without one logged React's key warning, and React could mix up their rows. So did the image
// viewer opened on a file sent twice. Rows without an id also shared one entry in the rise-in plan.

const NOW = Date.now();

function withoutId(text: string, createdAt: number): Activity {
  const { id: _id, ...rest } = comment('x', text, { type: 'event', createdAt });
  return rest as Activity;
}

const at = (seconds: number) => ({ createdAt: NOW - seconds * 1000 });
const F1 = attachment('f1', { activityId: 'c2' });

const activity = (): Activity[] => [
  comment('c1', 'First with a shared id', { type: 'event', ...at(50) }),
  comment('c1', 'Second with a shared id', { type: 'event', ...at(40) }),
  withoutId('A row without an id', 30),
  comment('no-id-0', 'A row whose id looks made up', { type: 'event', ...at(20) }),
  comment('c2', 'A comment with a file twice', { attachments: [F1, F1], ...at(10) }),
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

describe('regression: repeated ids', () => {
  it('shows every row and file without a key warning', () => {
    const A1 = attachment('a1');
    const detail = makeTicketDetail(undefined, { activity: activity(), attachments: [A1, A1] });
    const rendered = renderTicket({ detail });
    cleanups.push(rendered.restorePhone);
    const log = screen.getByRole('region', { name: 'Activity' });

    for (const text of [
      'First with a shared id',
      'Second with a shared id',
      'A row without an id',
      'A row whose id looks made up',
      'A comment with a file twice',
    ])
      expect(within(log).getByText(text, { exact: false })).toBeInTheDocument();
    expect(keyWarnings()).toEqual([]);
  });

  it('opens a file the tracker sent twice in the image viewer without a key warning', async () => {
    const user = userEvent.setup();
    const rendered = renderTicket({
      detail: makeTicketDetail(undefined, { activity: activity() }),
    });
    cleanups.push(rendered.restorePhone);
    const log = screen.getByRole('region', { name: 'Activity' });

    await user.click(within(log).getByRole('button', { name: 'Open image 2' }));
    expect(await screen.findByRole('dialog', { name: 'Image viewer' })).toBeInTheDocument();
    expect(keyWarnings()).toEqual([]);
  });

  it('plans a rise-in for every row, also those without an id', () => {
    const items = activityItems([withoutId('one', 1), withoutId('two', 2), ...activity()]);
    expect(firstRise(items).delays.size).toBe(items.length);
  });
});
