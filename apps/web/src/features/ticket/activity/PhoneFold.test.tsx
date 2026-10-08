import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket } from '../test/renderTicket';

const CLAUDE = { kind: 'agent', name: 'Claude (worker 41)' } as const;
const LONG = 'Decisions: the calendar shows with a mouse on a window 768px or wider. '.repeat(12);
const SHORT = 'Committed in 00678ed.';

// jsdom lays nothing out: text is as tall as it is long, at 50 characters a line of 21px.
const textHeight = (element: HTMLElement) =>
  element.matches('[class~="text"]') ? ((element.textContent ?? '').length / 50) * 21 : 0;

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  const spy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return textHeight(this);
  });
  cleanups = [skipAnimations(), () => spy.mockRestore()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

const activity = [
  comment('c1', LONG, { actor: CLAUDE }),
  comment('c2', SHORT, { actor: CLAUDE }),
  comment('r1', `TICKET: MOB-1\nSTATUS: done\nSUMMARY: ${LONG}\nFILES: src/a.ts`, {
    type: 'report',
    actor: CLAUDE,
  }),
  comment('v1', LONG, {
    type: 'review',
    actor: { kind: 'agent', name: 'Claude (reviewer 46)' },
    review: { verdict: 'approved', rating: 5 },
  }),
];

function setup(phone: boolean) {
  const detail = makeTicketDetail(listItem(1, STATUS.reviewed, 0), { activity });
  cleanups.push(renderTicket({ detail, phone }).restorePhone);
}

const log = () => screen.getByRole('region', { name: 'Activity' });
const cards = () => within(log()).getAllByRole('article');

describe('long activity on a phone', () => {
  it('folds long comments, reports and reviews, and leaves short ones whole', () => {
    setup(true);
    const [long, short, report, review] = cards();
    expect(within(long!).getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    expect(within(short!).queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(within(report!).getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    expect(within(review!).getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    const latest = screen.getByRole('region', { name: 'Latest review' });
    expect(within(latest).getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('opens one card at a time', async () => {
    const user = userEvent.setup();
    setup(true);
    const [long, , report] = cards();
    await user.click(within(long!).getByRole('button', { name: 'Show more' }));
    expect(within(long!).getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    expect(within(report!).getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });
});

it('shows everything whole on desktop', () => {
  setup(false);
  expect(screen.queryAllByRole('button', { name: 'Show more' })).toHaveLength(0);
});
