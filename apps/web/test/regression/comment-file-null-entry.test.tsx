import { screen, within } from '@testing-library/react';
import type { Activity, Attachment } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { attachment, comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 65 (PT-93): a null in a comment's own list of files made the whole comment "Couldn't
// show this item", and so did a list of files the tracker sent as something else, such as null.

const ODD = [null, 5, [1], {}] as unknown as Attachment[];
const NOW = Date.now();

const activity = (): Activity[] => [
  comment('c1', 'A comment with an odd file', {
    attachments: [...ODD, attachment('f1', { activityId: 'c1' })],
    createdAt: NOW - 20_000,
  }),
  comment('r1', 'A report with an odd file', {
    type: 'report',
    attachments: [null, attachment('f2', { activityId: 'r1' })] as Attachment[],
    createdAt: NOW - 10_000,
  }),
  comment('c2', 'A comment without a list of files', {
    attachments: null as unknown as Attachment[],
    createdAt: NOW,
  }),
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

it('shows a comment and a report around a file entry it cannot read', () => {
  const rendered = renderTicket({ detail: makeTicketDetail(undefined, { activity: activity() }) });
  cleanups.push(rendered.restorePhone);
  const log = screen.getByRole('region', { name: 'Activity' });

  expect(within(log).queryByText("Couldn't show this item")).toBeNull();
  expect(within(log).getByText('A comment with an odd file')).toBeInTheDocument();
  expect(within(log).getByText('A comment without a list of files')).toBeInTheDocument();
  expect(within(log).getAllByRole('button', { name: 'Open image 1' })).toHaveLength(2);
});
