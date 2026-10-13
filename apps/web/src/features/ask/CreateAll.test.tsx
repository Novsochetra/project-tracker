import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseTicketKey, type CardTicketInput, type ChatDetail } from '@tracker/shared';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChatDetail, makeMessage, ticketCardText } from '../../api/test/chatFixtures';
import { listItem, makeTicketDetail, STATUS } from '../../api/test/fixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { renderAsk } from './test/renderAsk';

const SPLIT = [ticketCardText('One'), ticketCardText('Two', 'low'), ticketCardText('Three')].join(
  '\n',
);

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

// A tracker that makes each card's ticket once, as the client id does, numbering them as it goes.
function fakeTracker(text: string, failOnce: number | null = null) {
  let detail = makeChatDetail({ messages: [makeMessage({ id: 'm-1', role: 'claude', text })] });
  let failed = false;
  const made = new Map<number, string>();
  const createCardTicket = vi.fn(
    async (_chat: string, _message: string, input: CardTicketInput) => {
      const index = input.index ?? 0;
      if (index === failOnce && !failed) {
        failed = true;
        throw new ApiError(500, 'internal', 'Database is locked');
      }
      if (!made.has(index)) made.set(index, `MOB-${made.size + 1}`);
      const cardTickets = [...made].map(([at, ticketKey]) => ({ index: at, ticketKey }));
      detail = { ...detail, messages: detail.messages.map((each) => ({ ...each, cardTickets })) };
      return Promise.resolve(detail);
    },
  );
  const getChat = vi.fn(async (): Promise<ChatDetail> => Promise.resolve(detail));
  const getTicket = vi.fn(async (key: string) =>
    Promise.resolve(
      makeTicketDetail(listItem(parseTicketKey(key)?.num ?? 1, STATUS.todo, 0, { title: key })),
    ),
  );
  restore = renderAsk({
    client: {
      getChat,
      createCardTicket,
      getTicket,
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
      listTicketRuns: vi.fn().mockResolvedValue([]),
    },
  }).restore;
  return createCardTicket;
}

const sent = (create: ReturnType<typeof fakeTracker>) =>
  create.mock.calls.map(([, , input]) => [input.index, input.title]);
const createAll = () => screen.findByRole('button', { name: 'Create all' });

describe('Ask: several ticket cards', () => {
  it('shows every card and makes them all in order with one tap, edits included', async () => {
    const create = fakeTracker(SPLIT);
    const user = userEvent.setup();
    const cards = await screen.findAllByRole('region', { name: 'Ticket card' });
    expect(cards).toHaveLength(3);
    const title = within(cards[1]!).getByRole('textbox', { name: 'Ticket title' });
    await user.clear(title);
    await user.type(title, 'Two, edited');
    await user.click(await createAll());

    for (const key of ['MOB-1', 'MOB-2', 'MOB-3']) {
      const made = await screen.findByRole('region', { name: `Ticket ${key}` });
      expect(within(made).getByRole('button', { name: `Run ${key} in Claude Code` })).toBeVisible();
    }
    expect(sent(create)).toEqual([
      [0, 'One'],
      [1, 'Two, edited'],
      [2, 'Three'],
    ]);
    expect(create.mock.calls[1]?.[2]).toMatchObject({ priority: 'low' });
    expect(screen.queryByRole('button', { name: 'Create all' })).not.toBeInTheDocument();
  });

  it('makes nothing twice on a double tap', async () => {
    const create = fakeTracker(SPLIT);
    const user = userEvent.setup();
    await user.dblClick(await createAll());
    await screen.findByRole('region', { name: 'Ticket MOB-3' });
    expect(sent(create)).toEqual([
      [0, 'One'],
      [1, 'Two'],
      [2, 'Three'],
    ]);
  });

  it('keeps what it made when one fails, and the next tap makes only the rest', async () => {
    const create = fakeTracker(SPLIT, 1);
    const user = userEvent.setup();
    await user.click(await createAll());
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is locked');
    expect(screen.getByRole('region', { name: 'Ticket MOB-1' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Ticket card' })).toHaveLength(2);

    await user.click(await createAll());
    await screen.findByRole('region', { name: 'Ticket MOB-3' });
    expect(sent(create)).toEqual([
      [0, 'One'],
      [1, 'Two'],
      [1, 'Two'],
      [2, 'Three'],
    ]);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('waits for every card to have a title', async () => {
    fakeTracker(SPLIT);
    const user = userEvent.setup();
    const cards = await screen.findAllByRole('region', { name: 'Ticket card' });
    await user.clear(within(cards[2]!).getByRole('textbox', { name: 'Ticket title' }));
    expect(await createAll()).toBeDisabled();
  });

  it('offers no Create all for a single card', async () => {
    fakeTracker(ticketCardText('Only'));
    await screen.findByRole('region', { name: 'Ticket card' });
    expect(screen.queryByRole('button', { name: 'Create all' })).not.toBeInTheDocument();
  });
});
