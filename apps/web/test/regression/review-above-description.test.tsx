import { screen } from '@testing-library/react';
import type { Activity, ReviewVerdict } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS, statuses } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// The Latest review card sat under the description, so with a typical description (PT's median is
// 628 characters) the verdict, stars and summary were below the fold at 375x812, and at 320x568
// even 300 characters hid them. On desktop a reviewed ticket also showed two primary buttons:
// Send to Claude Code in the side panel and Move to Done in the card.

const DESCRIPTION = 'Open the screen, rotate the phone twice and check the avatar. '.repeat(11);

const review = (verdict: ReviewVerdict): Activity =>
  comment('v1', 'Checked on a phone.', {
    type: 'review',
    actor: { kind: 'agent', name: 'Claude (reviewer)' },
    review: { verdict, rating: verdict === 'approved' ? 4 : 2 },
  });

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function renderReviewed(statusId: string, verdict: ReviewVerdict, phone: boolean, done = true) {
  const item = listItem(3, statusId, 0, { description: DESCRIPTION });
  const detail = makeTicketDetail(item, {
    activity: [review(verdict)],
    statuses: done ? statuses : statuses.filter((status) => status.category !== 'done'),
  });
  cleanups.push(renderTicket({ detail, phone }).restorePhone);
}

const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const primaries = () =>
  screen
    .getAllByRole('button')
    .filter((button) => button.classList.contains('primary'))
    .map((button) => button.textContent);

describe.each([
  ['phone', true],
  ['desktop', false],
])('on a %s', (_device, phone) => {
  it.each([
    ['a reviewed ticket', STATUS.reviewed, 'approved'],
    ['a sent-back ticket', STATUS.todo, 'changes_requested'],
  ] as const)('puts the review of %s between the title and the description', (_n, id, verdict) => {
    renderReviewed(id, verdict, phone);
    const latest = screen.getByRole('region', { name: 'Latest review' });
    expect(follows(screen.getByLabelText('Title'), latest)).toBe(true);
    expect(follows(latest, screen.getByLabelText('Description'))).toBe(true);
  });
});

describe('the desktop side panel', () => {
  it('leaves Move to Done the only primary button of a reviewed ticket', () => {
    renderReviewed(STATUS.reviewed, 'approved', false);
    expect(primaries()).toEqual(['Move to Done']);
    expect(screen.getByRole('button', { name: 'Send to Claude Code' })).toHaveClass('secondary');
  });

  it.each([
    ['a sent-back ticket', STATUS.todo, 'changes_requested', true],
    ['a reviewed ticket without a done status', STATUS.reviewed, 'approved', false],
  ] as const)('keeps Send to Claude Code primary for %s', (_name, id, verdict, done) => {
    renderReviewed(id, verdict, false, done);
    expect(primaries()).toEqual(['Send to Claude Code']);
  });
});
