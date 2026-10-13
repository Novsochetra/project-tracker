import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_ASK_OPTIONS, type ChatDetail } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeAskRun, makeChat, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { listItem, makeTicketDetail, STATUS } from '../../api/test/fixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { currentPath } from '../../app/test/harness';
import { ASK_PLACEHOLDER, ASK_TICKET_PLACEHOLDER } from './copy';
import { renderAsk } from './test/renderAsk';

const dara = makeRunner();
const ticket = makeTicketDetail(listItem(3, STATUS.todo, 0, { title: 'Sync drops edits' }));
const aboutTicket = makeChat({ ticket: { key: 'MOB-3', title: 'Sync drops edits' } });

let restore: () => void;

afterEach(() => restore());

function setup(path: string, detail: ChatDetail | null, client: Record<string, unknown> = {}) {
  const rendered = renderAsk({
    path,
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      getTicket: vi.fn().mockResolvedValue(ticket),
      listRunners: vi.fn().mockResolvedValue([dara]),
      ...client,
    },
  });
  restore = rendered.restore;
  return rendered;
}

const ticketLink = () => screen.findByRole('link', { name: /About MOB-3/ });
const box = () => screen.findByRole('textbox', { name: 'Question for Claude' });

describe('Ask: a chat about a ticket', () => {
  it('starts from the ticket screen with the ticket on top, and sends it with the question', async () => {
    const detail = makeChatDetail({
      chat: aboutTicket,
      messages: [makeMessage()],
      run: makeAskRun(),
    });
    const startChat = vi.fn().mockResolvedValue(detail);
    const { client } = setup('/p/MOB/3/ask/new', null, { startChat });
    const user = userEvent.setup();
    expect(await screen.findByRole('link', { name: 'About MOB-3 Sync drops edits' })).toBeVisible();
    expect(screen.getByText(/about this ticket/)).toBeInTheDocument();

    await user.type(await screen.findByRole('textbox', { name: 'Question for Claude' }), 'Why?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(client.startChat).toHaveBeenCalledWith('MOB', {
      runnerId: dara.id,
      text: 'Why?',
      attachmentIds: [],
      ...DEFAULT_ASK_OPTIONS,
      ticketKey: 'MOB-3',
    });
    // The chat stays under the ticket, so Back returns to it.
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/3/ask/c-1'));
    expect(await ticketLink()).toBeInTheDocument();
  });

  it('links back to its ticket', async () => {
    setup('/p/MOB/ask/c-1', makeChatDetail({ chat: aboutTicket }));
    const link = await ticketLink();
    expect(link).toHaveAttribute('href', '/p/MOB/3');
    await userEvent.setup().click(link);
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/3'));
  });

  it('names no ticket once its ticket is deleted, or when it was about none', async () => {
    setup('/p/MOB/3/ask/c-1', makeChatDetail());
    expect(await screen.findByRole('list', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /About/ })).not.toBeInTheDocument();
  });

  // PT-208: a ticket chat kept the project's wording in its box.
  it('asks about the ticket in a new ticket chat', async () => {
    setup('/p/MOB/3/ask/new', null);
    expect(await box()).toHaveAttribute('placeholder', ASK_TICKET_PLACEHOLDER);
  });

  it('asks about the ticket in a chat about one, wherever it was opened from', async () => {
    setup('/p/MOB/ask/c-1', makeChatDetail({ chat: aboutTicket }));
    await ticketLink();
    expect(await box()).toHaveAttribute('placeholder', ASK_TICKET_PLACEHOLDER);
  });

  it('asks about the project in a chat about none', async () => {
    setup('/p/MOB/ask/c-1', makeChatDetail());
    expect(await screen.findByRole('list', { name: 'Messages' })).toBeInTheDocument();
    expect(await box()).toHaveAttribute('placeholder', ASK_PLACEHOLDER);
  });
});
