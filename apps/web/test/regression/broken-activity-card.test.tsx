import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import type { ReportSections } from '../../src/features/ticket/activity/reportSections';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import type { LinkPart } from '../../src/lib/linkify';
import { skipAnimations } from '../../src/overlays/testing';

// A comment that crashed the link parser (PT-28) blanked the whole app, and the comment couldn't
// be deleted, because nothing caught the error. Any card that fails to render did the same.

const CRASH = 'crashes the parser';

vi.mock('../../src/lib/linkify', async () => {
  const actual = await vi.importActual<{ linkParts: (text: string) => LinkPart[] }>(
    '../../src/lib/linkify',
  );
  return {
    ...actual,
    linkParts: (text: string) => {
      if (text.includes(CRASH)) throw new Error('Link parser crashed');
      return actual.linkParts(text);
    },
  };
});

vi.mock('../../src/features/ticket/activity/reportSections', async () => {
  const actual = await vi.importActual<{ reportSections: (text: string) => ReportSections | null }>(
    '../../src/features/ticket/activity/reportSections',
  );
  return {
    ...actual,
    reportSections: (text: string) => {
      if (text.includes(CRASH)) throw new Error('Report reader crashed');
      return actual.reportSections(text);
    },
  };
});

const BAD = `This ${CRASH}: https://x.dev/a`;
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

function setup(phone: boolean) {
  const activity = [
    comment('c1', 'Looks good, see https://x.dev/ok', { createdAt: Date.now() - 120_000 }),
    comment('c2', BAD, { createdAt: Date.now() - 60_000 }),
    comment('r1', `SUMMARY: ${BAD}`, { type: 'report', actor: CLAUDE, createdAt: Date.now() }),
  ];
  const deleteActivity = vi.fn().mockResolvedValue(undefined);
  const updateComment = vi.fn((id: string, input: { text: string }) =>
    Promise.resolve({ ...activity[1]!, id, text: input.text, editedAt: Date.now() }),
  );
  const rendered = renderTicket({
    detail: makeTicketDetail(undefined, { activity }),
    client: { deleteActivity, updateComment },
    phone,
  });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const log = () => screen.getByRole('region', { name: 'Activity' });
const unshown = () =>
  within(log())
    .getAllByText("Couldn't show this item")
    .map((notice) => notice.closest('article')!);

it('shows a card that fails as its plain text and keeps the rest of the ticket', () => {
  setup(false);
  expect(screen.getByLabelText('Title')).toHaveValue('Ticket 1');
  expect(within(log()).getByRole('link', { name: 'https://x.dev/ok' })).toBeInTheDocument();
  const [badComment, badReport] = unshown();
  expect(badComment).toHaveTextContent(BAD);
  expect(badReport).toHaveTextContent(`SUMMARY: ${BAD}`);
  expect(within(badComment!).queryByRole('link')).toBeNull();
  expect(consoleError).toHaveBeenCalledWith(
    expect.stringContaining('c2'),
    expect.objectContaining({ message: 'Link parser crashed' }),
    expect.anything(),
  );
});

it('deletes a card that fails from its menu', async () => {
  const user = userEvent.setup();
  const { client } = setup(false);
  const [badComment, badReport] = unshown();
  await user.click(within(badReport!).getByRole('button', { name: 'Report options' }));
  await user.click(screen.getByRole('button', { name: 'Delete report' }));
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(client.deleteActivity).toHaveBeenCalledWith('r1');

  await user.click(within(badComment!).getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Delete comment' }));
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(client.deleteActivity).toHaveBeenCalledWith('c2');
  expect(within(log()).queryByText("Couldn't show this item")).toBeNull();
  expect(within(log()).getByText(/Looks good/)).toBeInTheDocument();
});

it('edits a comment that fails from its menu on a phone', async () => {
  const user = userEvent.setup();
  const { client } = setup(true);
  const [badComment] = unshown();
  await user.click(within(badComment!).getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  const editor = within(badComment!).getByLabelText('Edit comment');
  expect(editor).toHaveValue(BAD);
  await user.clear(editor);
  await user.type(editor, 'Fixed text');
  await user.click(within(badComment!).getByRole('button', { name: 'Save' }));
  expect(client.updateComment).toHaveBeenCalledWith('c2', { text: 'Fixed text' });
});
