import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { linkParts } from '../../src/lib/linkify';
import { skipAnimations } from '../../src/overlays/testing';

// A comment of "https://x.dev/" and 19,000 ")" blanked the whole app with "Maximum call stack size
// exceeded": the link trimmer called itself once per trailing bracket and counted the brackets of
// the whole text on every call. A URL, 20,000 dots and a letter took about a second per render,
// because the trailing-punctuation regex backtracked through the dots from every start.

const URL = 'https://x.dev/';
// Linear work takes a few milliseconds even at 100,000 characters, while the old quadratic work
// took seconds. A loaded machine can stretch a few milliseconds past 100, so the budget is wide.
const BUDGET_MS = 1_000;

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function timedParts(text: string) {
  const start = performance.now();
  const parts = linkParts(text);
  return { parts, ms: performance.now() - start };
}

it('shows a ticket whose comment and review end in 19,000 brackets', () => {
  const brackets = `${URL}${')'.repeat(19_000)}`;
  const reviewer = { kind: 'agent', name: 'Claude (reviewer)' } as const;
  const activity = [
    comment('c1', brackets),
    comment('v1', brackets, {
      type: 'review',
      actor: reviewer,
      review: { verdict: 'approved', rating: 4 },
    }),
  ];
  const detail = makeTicketDetail(listItem(1, STATUS.reviewed, 0), { activity });
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
  const log = screen.getByRole('region', { name: 'Activity' });
  const links = within(log).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([URL, URL]);
  expect(log).toHaveTextContent(brackets);
  const latest = screen.getByRole('region', { name: 'Latest review' });
  expect(within(latest).getByRole('link')).toHaveAttribute('href', URL);
});

describe.each([20_000, 100_000])('text of %i characters', (size) => {
  it.each([
    ['closing brackets', ')', [URL]],
    ['brackets and dots', ').', [URL]],
    ['dots', '.', [URL]],
  ])('trims trailing %s in time', (_name, unit, expected) => {
    const { parts, ms } = timedParts(`${URL}${unit.repeat(size / unit.length)}`);
    expect(parts.flatMap((part) => (part.kind === 'link' ? [part.href] : []))).toEqual(expected);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('keeps a run of dots that a letter follows in time', () => {
    const text = `${URL}${'.'.repeat(size)}a`;
    const { parts, ms } = timedParts(text);
    expect(parts).toEqual([{ kind: 'link', text, href: text }]);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
