import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatDetail, Run, Runner } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChatDetail, makeMessage, ticketCardText } from '../../api/test/chatFixtures';
import { listItem, makeTicketDetail, STATUS } from '../../api/test/fixtures';
import { DARA, makeRun, makeRunner } from '../../api/test/runFixtures';
import { currentPath } from '../../app/test/harness';
import { renderAsk } from './test/renderAsk';

const dara = makeRunner();
const PROMPT = 'Please work on ticket MOB-7 from my "Mobile app" project.';
const ticket = makeTicketDetail(listItem(7, STATUS.todo, 0, { title: 'Faster sync' }));

const withCards = (...texts: string[]): ChatDetail =>
  makeChatDetail({
    messages: texts.map((text, index) =>
      makeMessage({ id: `m-${index + 1}`, role: 'claude', text }),
    ),
  });

const created = (detail: ChatDetail, messageId: string): ChatDetail => ({
  ...detail,
  messages: detail.messages.map((message) =>
    message.id === messageId ? { ...message, ticketKey: 'MOB-7' } : message,
  ),
});

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function setup(
  detail: ChatDetail,
  client: Record<string, unknown> = {},
  runners: Runner[] = [dara],
) {
  const rendered = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue(runners),
      getTicket: vi.fn().mockResolvedValue(ticket),
      listTicketRuns: vi.fn().mockResolvedValue([]),
      ...client,
    },
  });
  restore = rendered.restore;
  return rendered;
}

const ticketCard = () => screen.findByRole('region', { name: 'Ticket card' });

describe('Ask: ticket cards', () => {
  it('shows the card between the text around it, with fields to edit by hand', async () => {
    setup(withCards(ticketCardText('Sync faster')));
    const card = await ticketCard();
    const claude = screen.getByRole('article', { name: 'Claude' });
    expect(claude).toHaveTextContent(/Here is a ticket:.*Sync faster.*Tap Create/);
    expect(within(card).getByRole('textbox', { name: 'Ticket title' })).toHaveValue('Sync faster');
    expect(within(card).getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Why: sync is slow.',
    );
    expect(within(card).getByRole('button', { name: /^Priority/ })).toHaveTextContent('High');
  });

  it('creates the ticket from the edited card, then links to it and offers Run', async () => {
    const detail = withCards(ticketCardText('Sync faster'));
    const createCardTicket = vi.fn().mockResolvedValue(created(detail, 'm-1'));
    const getChat = vi.fn().mockResolvedValueOnce(detail).mockResolvedValue(created(detail, 'm-1'));
    const { client } = setup(detail, { createCardTicket, getChat });
    const user = userEvent.setup();
    const title = within(await ticketCard()).getByRole('textbox', { name: 'Ticket title' });
    await user.clear(title);
    await user.type(title, 'Faster sync');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(client.createCardTicket).toHaveBeenCalledWith('c-1', 'm-1', {
      title: 'Faster sync',
      description: 'Why: sync is slow.',
      priority: 'high',
    });
    const made = await screen.findByRole('region', { name: 'Ticket MOB-7' });
    expect(within(made).getByText('Faster sync')).toBeInTheDocument();
    expect(within(made).getByRole('button', { name: 'Run MOB-7 in Claude Code' })).toBeVisible();
    await user.click(within(made).getByRole('link', { name: 'MOB-7' }));
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/7'));
  });

  it('keeps Create off while the title is empty', async () => {
    setup(withCards(ticketCardText('Sync faster')));
    const user = userEvent.setup();
    await user.clear(within(await ticketCard()).getByRole('textbox', { name: 'Ticket title' }));
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('runs the made ticket with the normal ticket prompt and follows the run', async () => {
    const running = makeRun({ ticketKey: 'MOB-7', status: 'running', startedAt: Date.now() });
    const cancelled: Run = { ...running, status: 'cancelled', endedAt: Date.now() };
    const startRun = vi.fn().mockResolvedValue(running);
    const cancelRun = vi.fn().mockResolvedValue(cancelled);
    const getTicketPrompt = vi
      .fn()
      .mockResolvedValue({ text: PROMPT, ticketCount: 1, role: 'work' });
    const listTicketRuns = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([running])
      .mockResolvedValue([cancelled]);
    const detail = created(withCards(ticketCardText('Sync faster')), 'm-1');
    const { client } = setup(detail, { startRun, cancelRun, getTicketPrompt, listTicketRuns });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Run MOB-7 in Claude Code' }));

    expect(client.startRun).toHaveBeenCalledWith('MOB-7', {
      runnerId: dara.id,
      prompt: PROMPT,
      role: 'work',
    });
    expect(await screen.findByText(`Sent to Claude on ${DARA}`)).toBeInTheDocument();
    const made = screen.getByRole('region', { name: 'Ticket MOB-7' });
    expect(made).toHaveTextContent(`Claude is working on ${DARA}…`);
    await user.click(within(made).getByRole('button', { name: 'Cancel' }));
    expect(client.cancelRun).toHaveBeenCalledWith(running.id);
    await waitFor(() => expect(made).not.toHaveTextContent(/Claude is working/));
  });

  it('shows an older card that never became a ticket as replaced, without Create', async () => {
    setup(withCards(ticketCardText('First try'), ticketCardText('Second try', 'low')));
    const replaced = await screen.findByRole('region', { name: 'Replaced ticket card' });
    expect(replaced).toHaveTextContent('First try');
    expect(replaced).toHaveTextContent('Replaced');
    expect(screen.getAllByRole('button', { name: 'Create' })).toHaveLength(1);
    expect(within(await ticketCard()).getByRole('textbox', { name: 'Ticket title' })).toHaveValue(
      'Second try',
    );
  });

  it('keeps a card that became a ticket, even after a newer card', async () => {
    const detail = created(withCards(ticketCardText('Made one'), ticketCardText('Another')), 'm-1');
    setup(detail);
    expect(await screen.findByRole('region', { name: 'Ticket MOB-7' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Replaced ticket card' })).not.toBeInTheDocument();
    expect(await ticketCard()).toBeInTheDocument();
  });

  it('shows a broken card as plain text', async () => {
    const broken = 'Here:\n```ticket\nPriority: high\n---\nNo title.\n```';
    setup(withCards(broken));
    const claude = await screen.findByRole('article', { name: 'Claude' });
    expect(claude).toHaveTextContent('Priority: high');
    expect(screen.queryByRole('region', { name: 'Ticket card' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });
});
