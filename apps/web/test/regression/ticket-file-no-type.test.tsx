import { screen, within } from '@testing-library/react';
import type { Activity, Attachment, TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { attachment, comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 65 (PT-93): a file entry without a type, such as { activityId: null }, failed the whole
// Ticket screen on phones and desktops: telling its kind split an undefined type. A text file
// without a name failed it the same way when its tile split the name.

const odd = (entry: object): Attachment => entry as Attachment;

const ODD_TICKET_FILES = [
  odd({ activityId: null }),
  odd({ ...attachment('t1', { fileName: 't1.txt' }), mimeType: undefined }),
  odd({ ...attachment('t2', { mimeType: 'text/plain' }), fileName: undefined }),
];

const COMMENT_FILES = [
  odd({ ...attachment('c-odd', { activityId: 'c1' }), mimeType: 5 }),
  attachment('c-ok', { activityId: 'c1', fileName: 'kept.txt', mimeType: 'text/plain' }),
];

const detail = (): TicketDetail =>
  makeTicketDetail(undefined, {
    attachments: [attachment('a1'), ...ODD_TICKET_FILES, attachment('a2')],
    activity: [comment('c1', 'A comment with files', { attachments: COMMENT_FILES })] as Activity[],
  });

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

describe('regression: a file entry without a type or name', () => {
  it.each([
    ['a desktop', false],
    ['a phone', true],
  ])('leaves it out and shows the other files on %s', (_, phone) => {
    const rendered = renderTicket({ detail: detail(), phone });
    cleanups.push(rendered.restorePhone);

    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open image 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /t1\.txt|undefined/ })).toBeNull();

    const log = screen.getByRole('region', { name: 'Activity' });
    expect(within(log).queryByText("Couldn't show this item")).toBeNull();
    expect(within(log).getByText('A comment with files')).toBeInTheDocument();
    expect(within(log).getByRole('button', { name: 'Open kept.txt' })).toBeInTheDocument();
    expect(within(log).getAllByRole('button', { name: /^Open / })).toHaveLength(1);
  });
});
