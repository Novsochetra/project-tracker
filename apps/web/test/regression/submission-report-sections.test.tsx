import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// A submission showed submit_for_review's raw TICKET / STATUS / SUMMARY / FILES / NEXT block in
// mono. "STATUS: done" contradicted a ticket waiting in Need review, or back in To do after
// changes were requested, and NEXT, the one line meant for the owner, came last.

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

it('shows a sent-back ticket’s submission without STATUS: done, its next step before the files', () => {
  const submission = comment(
    'r1',
    [
      'TICKET: MOB-4',
      'STATUS: done',
      'SUMMARY: Added dark mode colors for the Settings screen.',
      'FILES: src/settings/theme.ts',
      'NEXT: Check the footnote contrast',
    ].join('\n'),
    { type: 'report', actor: { kind: 'agent', name: 'Claude' } },
  );
  const detail = makeTicketDetail(listItem(4, STATUS.todo, 0), { activity: [submission] });
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
  const log = screen.getByRole('region', { name: 'Activity' });
  const card = within(log).getByText('Claude report').closest('article')!;
  expect(card).not.toHaveTextContent('STATUS: done');
  expect(card).toHaveTextContent('Submitted for review');
  const summary = within(card).getByText('Added dark mode colors for the Settings screen.');
  expect(summary.closest('.reportBody')).toBeNull();
  const next = within(card).getByText('Check the footnote contrast');
  const files = within(card).getByText('src/settings/theme.ts');
  expect(next.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
