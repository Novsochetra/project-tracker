import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';
import { phoneStyle, pixels } from './phoneCss';

// From PT-30's review: "NEXT: **none**" still showed a Next panel, "src/a.ts (parser, tests)"
// became two files, a summary line starting with "Next:" sent the whole card back to the raw
// block, and PT-23's 46 files made a 3,700px card at 320px.

// The Show more button the report's Files list and folded text share.
const MODULE = 'components/Fold/Fold.module.css';
const CLAUDE = { kind: 'agent', name: 'Claude' } as const;
const lines = (...parts: string[]) => parts.join('\n');

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function renderReport(text: string, phone = false) {
  const report = comment('r1', text, { type: 'report', actor: CLAUDE, createdAt: Date.now() });
  const detail = makeTicketDetail(undefined, { activity: [report] });
  cleanups.push(renderTicket({ detail, phone }).restorePhone);
  const log = screen.getByRole('region', { name: 'Activity' });
  return within(log).getByText('Claude report').closest('article')!;
}

const terms = (card: HTMLElement) =>
  within(card)
    .queryAllByRole('term')
    .map((term) => term.textContent);

const files = (card: HTMLElement) =>
  within(card)
    .queryAllByRole('listitem')
    .map((item) => item.textContent);

it('reads a bold none, a note in brackets and a Next: line in the summary', () => {
  const card = renderReport(
    lines(
      'TICKET: PT-30',
      'STATUS: done',
      'SUMMARY: Report cards show sections.',
      'Next: a reviewer checks 320px.',
      'FILES: src/a.ts (parser, tests)',
      'NEXT: **none**',
    ),
  );
  expect(terms(card)).toEqual(['Summary', 'Files']);
  expect(card).toHaveTextContent('Report cards show sections. Next: a reviewer checks 320px.');
  expect(files(card)).toEqual(['src/a.ts (parser, tests)']);
});

it('shows five of a long Files list and a Show N more button with a 44px target', async () => {
  const user = userEvent.setup();
  const names = Array.from({ length: 46 }, (_, index) => `apps/web/src/file${index + 1}.ts`);
  const card = renderReport(
    lines('STATUS: done', 'SUMMARY: Ready for you.', `FILES: ${names.join('\n')}`, 'NEXT: none'),
    true,
  );
  expect(files(card)).toEqual(names.slice(0, 5));
  const more = within(card).getByRole('button', { name: 'Show 41 more' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  expect(pixels(phoneStyle(more, MODULE).get('min-height'))).toBeGreaterThanOrEqual(44);

  more.focus();
  await user.keyboard('{Enter}');
  expect(files(card)).toEqual(names);
  const less = within(card).getByRole('button', { name: 'Show less' });
  expect(less).toHaveAttribute('aria-expanded', 'true');
  await user.keyboard(' ');
  expect(files(card)).toHaveLength(5);
});

it('shows six files without a button, which would only hide one', () => {
  const names = Array.from({ length: 6 }, (_, index) => `src/file${index + 1}.ts`);
  const card = renderReport(lines('SUMMARY: Six files.', `FILES: ${names.join(', ')}`));
  expect(files(card)).toEqual(names);
  expect(within(card).queryByRole('button', { name: /more/ })).toBeNull();
});
