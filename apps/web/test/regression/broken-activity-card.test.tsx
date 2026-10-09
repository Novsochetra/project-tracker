import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Activity, Actor, ReviewVerdict, TicketDetail } from '@tracker/shared';
import { afterEach, beforeAll, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../src/api';
import { comment, listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { TicketScreen } from '../../src/app/lazyParts';
import { renderScreen } from '../../src/app/renderScreen';
import { readMenuConfirm } from '../../src/components/Popover/testing';
import type { ReportSections } from '../../src/features/ticket/activity/reportSections';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import type { LinkPart } from '../../src/lib/linkify';
import { readActionSheet, skipAnimations } from '../../src/overlays/testing';

// A comment that crashed the link parser (PT-28) blanked the whole app, and the comment couldn't
// be deleted, because nothing caught the error. Any card that fails to render did the same. Then
// (PT-51 review) the latest review under the title still took the whole screen down, an item with
// an actor the app couldn't read did too, and a card stayed "Couldn't show this item" after an
// edit fixed it.

const CRASH = 'crashes the parser';

// The app loads this code when it is first needed; here it is in before the first render.
beforeAll(() => TicketScreen.preload());

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
const REVIEWER = { kind: 'agent', name: 'Claude (reviewer)' } as const;
const UNREADABLE = null as unknown as Actor;

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

const brokenActivity = (): Activity[] => [
  comment('c1', 'Looks good, see https://x.dev/ok', { createdAt: Date.now() - 120_000 }),
  comment('c2', BAD, { createdAt: Date.now() - 60_000 }),
  comment('r1', `SUMMARY: ${BAD}`, { type: 'report', actor: CLAUDE, createdAt: Date.now() }),
];

const review = (verdict: ReviewVerdict, extra: Partial<Activity> = {}) =>
  comment('v1', `Still broken. ${BAD}`, {
    type: 'review',
    actor: REVIEWER,
    review: { verdict, rating: verdict === 'approved' ? 4 : 2 },
    createdAt: Date.now(),
    ...extra,
  });

interface SetupOptions {
  phone?: boolean;
  statusId?: string;
  activity?: Activity[];
}

// Inside the real screen boundary, so an error that escapes the cards shows as the screen's
// "Something went wrong" instead of passing the test by accident.
function setup({ phone = false, statusId = STATUS.todo, activity }: SetupOptions = {}) {
  const items = activity ?? brokenActivity();
  const deleteActivity = vi.fn().mockResolvedValue(undefined);
  const updateComment = vi.fn((id: string, input: { text: string }) =>
    Promise.resolve({ ...items.find((item) => item.id === id)!, text: input.text, editedAt: 9 }),
  );
  const updateTicket = vi.fn().mockReturnValue(new Promise(() => undefined));
  const rendered = renderTicket({
    detail: makeTicketDetail(listItem(1, statusId, 0), { activity: items }),
    client: { deleteActivity, updateComment, updateTicket },
    phone,
    children: renderScreen({ name: 'ticket', key: 'MOB', num: 1 }),
  });
  cleanups.push(rendered.restorePhone);
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return rendered;
}

const log = () => screen.getByRole('region', { name: 'Activity' });
const latest = () => screen.getByRole('region', { name: 'Latest review' });
const unshown = () =>
  within(log())
    .queryAllByText("Couldn't show this item")
    .map((notice) => notice.closest('article')!);

// As a live update would: the cache tells the screen on its next tick.
async function changeActivity(
  queryClient: ReturnType<typeof setup>['queryClient'],
  id: string,
  text: string,
) {
  await act(async () => {
    queryClient.setQueryData<TicketDetail>(queryKeys.ticket('MOB-1'), (detail) =>
      detail
        ? {
            ...detail,
            activity: detail.activity.map((item) => (item.id === id ? { ...item, text } : item)),
          }
        : detail,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

it('shows a card that fails as its plain text and keeps the rest of the ticket', () => {
  setup();
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
  const { client } = setup();
  const [badComment, badReport] = unshown();
  await user.click(within(badReport!).getByRole('button', { name: 'Report options' }));
  await user.click(screen.getByRole('button', { name: 'Delete report' }));
  await readMenuConfirm();
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(client.deleteActivity).toHaveBeenCalledWith('r1');

  await user.click(within(badComment!).getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Delete comment' }));
  await readMenuConfirm();
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(client.deleteActivity).toHaveBeenCalledWith('c2');
  expect(within(log()).queryByText("Couldn't show this item")).toBeNull();
  expect(within(log()).getByText(/Looks good/)).toBeInTheDocument();
});

it('edits a comment that fails from its menu on a phone', async () => {
  const user = userEvent.setup();
  const { client } = setup({ phone: true });
  const [badComment] = unshown();
  await user.click(within(badComment!).getByRole('button', { name: 'Comment options' }));
  await readActionSheet();
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  const editor = within(badComment!).getByLabelText('Edit comment');
  expect(editor).toHaveValue(BAD);
  await user.clear(editor);
  await user.type(editor, 'Fixed text');
  await user.click(within(badComment!).getByRole('button', { name: 'Save' }));
  expect(client.updateComment).toHaveBeenCalledWith(
    'c2',
    { text: 'Fixed text' },
    { text: 'This crashes the parser: https://x.dev/a' },
  );
});

it.each([
  ['a desktop', false],
  ['a phone', true],
])(
  'keeps a sent-back ticket whose latest review fails, with its Delete, on %s',
  async (_, phone) => {
    const user = userEvent.setup();
    const { client } = setup({
      phone,
      activity: [brokenActivity()[0]!, review('changes_requested')],
    });
    expect(latest()).toHaveTextContent("Couldn't show this item");
    expect(latest()).toHaveTextContent(`Still broken. ${BAD}`);
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(within(log()).getByRole('link', { name: 'https://x.dev/ok' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Latest review v1'),
      expect.objectContaining({ message: 'Link parser crashed' }),
      expect.anything(),
    );
    await user.click(within(latest()).getByRole('button', { name: 'Review options' }));
    if (phone) await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Delete review' }));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(client.deleteActivity).toHaveBeenCalledWith('v1'));
  },
);

it('keeps Move to Done on a reviewed ticket whose review fails', async () => {
  const user = userEvent.setup();
  const { client } = setup({ statusId: STATUS.reviewed, activity: [review('approved')] });
  expect(latest()).toHaveTextContent("Couldn't show this item");
  await user.click(within(latest()).getByRole('button', { name: 'Move to Done' }));
  expect(client.updateTicket).toHaveBeenCalledWith('MOB-1', { statusId: STATUS.done });
});

it('names an author it cannot read "Someone", and shows an unknown kind of item as its text', () => {
  setup({
    activity: [
      comment('c3', 'Who wrote this? https://x.dev/who', { actor: UNREADABLE, createdAt: 1 }),
      comment('r3', 'SUMMARY: Done.', { type: 'report', actor: UNREADABLE, createdAt: 2 }),
      comment('p1', 'A poll from a newer tracker', {
        type: 'poll' as Activity['type'],
        createdAt: 3,
      }),
      review('changes_requested', { actor: { kind: 'robot' } as unknown as Actor, text: 'No.' }),
    ],
  });
  const [someone] = within(log()).getAllByText('Someone');
  const card = someone!.closest('article')!;
  expect(within(card).getByRole('link', { name: 'https://x.dev/who' })).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'Comment options' })).toBeInTheDocument();
  expect(within(log()).getByText('Claude Code report')).toBeInTheDocument();
  const [poll] = unshown();
  expect(poll).toHaveTextContent('A poll from a newer tracker');
  expect(within(poll!).queryByRole('button')).toBeNull();
  expect(latest()).toHaveTextContent('Someone reviewed');
  expect(latest()).toHaveTextContent('Changes requested');
});

it('shows the card again once an edit from its stand-in is saved, focus on its menu', async () => {
  const user = userEvent.setup();
  const { client } = setup();
  const [badComment] = unshown();
  await user.click(within(badComment!).getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  const editor = within(badComment!).getByLabelText('Edit comment');
  await user.clear(editor);
  await user.type(editor, 'Fixed, see https://x.dev/fixed');
  await user.click(within(badComment!).getByRole('button', { name: 'Save' }));
  expect(client.updateComment).toHaveBeenCalledWith(
    'c2',
    { text: 'Fixed, see https://x.dev/fixed' },
    { text: 'This crashes the parser: https://x.dev/a' },
  );
  const link = await within(log()).findByRole('link', { name: 'https://x.dev/fixed' });
  const card = link.closest('article')!;
  expect(card).not.toHaveTextContent("Couldn't show this item");
  expect(within(card).getByRole('button', { name: 'Comment options' })).toHaveFocus();
  expect(unshown()).toHaveLength(1);
});

it('tries a card again when its activity changes, but not under an open edit', async () => {
  const user = userEvent.setup();
  const { queryClient } = setup();
  await changeActivity(queryClient, 'r1', 'SUMMARY: Fixed elsewhere.');
  expect(within(log()).getByText(/Fixed elsewhere\./)).toBeInTheDocument();
  expect(unshown()).toHaveLength(1);

  const [badComment] = unshown();
  await user.click(within(badComment!).getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(within(badComment!).getByLabelText('Edit comment'), ' more');
  await changeActivity(queryClient, 'c2', 'Fixed elsewhere: https://x.dev/elsewhere');
  const editor = within(log()).getByLabelText('Edit comment');
  expect(editor).toHaveValue(`${BAD} more`);
  expect(editor).toHaveFocus();
  expect(unshown()).toHaveLength(1);

  await user.click(within(log()).getByRole('button', { name: 'Cancel' }));
  expect(within(log()).getByRole('link', { name: 'https://x.dev/elsewhere' })).toBeInTheDocument();
  expect(unshown()).toHaveLength(0);
  expect(within(log()).getAllByRole('button', { name: 'Comment options' })[1]).toHaveFocus();
});
