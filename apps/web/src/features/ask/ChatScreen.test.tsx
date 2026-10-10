import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { DEFAULT_ASK_OPTIONS, type ChatDetail, type Runner } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAskRun, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { DARA, makeRunner } from '../../api/test/runFixtures';
import { currentPath } from '../../app/test/harness';
import { LAST_HELPER_STORAGE_KEY } from '../claude/lastHelper';
import { renderAsk } from './test/renderAsk';

const dara = makeRunner();
const studio = makeRunner({ id: 'h-studio', name: 'Studio' });
const question = () => screen.findByRole('textbox', { name: 'Question for Claude' });
const sendButton = () => screen.queryByRole('button', { name: 'Send' });

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

interface SetupOptions {
  client?: Record<string, unknown>;
  path?: string;
}

function setup(detail: ChatDetail | null, runners: Runner[] = [dara], options: SetupOptions = {}) {
  const rendered = renderAsk({
    path: options.path ?? (detail ? `/p/MOB/ask/${detail.chat.id}` : '/p/MOB/ask/new'),
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue(runners),
      ...options.client,
    },
  });
  restore = rendered.restore;
  return rendered;
}

describe('Ask: the chat screen', () => {
  it('shows the messages, the person on one side and Claude on the other', async () => {
    setup(makeChatDetail());
    const messages = await screen.findByRole('list', { name: 'Messages' });
    expect(within(messages).getByRole('article', { name: 'You' })).toHaveTextContent(
      'How does sync work?',
    );
    expect(within(messages).getByRole('article', { name: 'Claude' })).toHaveTextContent(
      'It reads the queue every minute.',
    );
  });

  it('sends a follow-up to the helper and empties the box', async () => {
    const detail = makeChatDetail();
    const asked = {
      ...detail,
      messages: [...detail.messages, makeMessage({ id: 'm-3', text: 'And offline?' })],
      run: makeAskRun(),
    };
    const ask = vi.fn().mockResolvedValue(asked);
    const getChat = vi.fn().mockResolvedValueOnce(detail).mockResolvedValue(asked);
    const { client } = setup(detail, [dara], { client: { ask, getChat } });
    const user = userEvent.setup();
    await user.type(await question(), '  And offline?  ');
    await user.click(sendButton()!);

    expect(client.ask).toHaveBeenCalledWith('c-1', {
      runnerId: dara.id,
      text: 'And offline?',
      ...DEFAULT_ASK_OPTIONS,
    });
    expect(await question()).toHaveValue('');
    expect(await screen.findByText(`Claude is thinking on ${DARA}…`)).toBeInTheDocument();
    expect(localStorage.getItem(LAST_HELPER_STORAGE_KEY)).toBe(dara.id);
  });

  it('shows Claude thinking with Cancel, which cancels the ask', async () => {
    const running = makeAskRun({ status: 'running', startedAt: Date.now() });
    const cancelled = { ...running, status: 'cancelled' as const, endedAt: Date.now() };
    const cancelRun = vi.fn().mockResolvedValue(cancelled);
    const getChat = vi
      .fn()
      .mockResolvedValueOnce(makeChatDetail({ run: running }))
      .mockResolvedValue(makeChatDetail({ run: cancelled }));
    const { client } = setup(null, [dara], {
      client: { cancelRun, getChat },
      path: '/p/MOB/ask/c-1',
    });
    const user = userEvent.setup();

    expect(await screen.findByText(`Claude is thinking on ${DARA}…`)).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(client.cancelRun).toHaveBeenCalledWith(running.id);
    await waitFor(() => expect(screen.queryByText(/Claude is thinking/)).not.toBeInTheDocument());
  });

  it('says why Claude stopped and lets the person ask again', async () => {
    const failed = makeAskRun({ status: 'failed', error: 'Claude exited with code 1.' });
    setup(makeChatDetail({ run: failed }));
    const user = userEvent.setup();
    expect(await screen.findByText('Claude stopped: Claude exited with code 1.')).toBeVisible();
    await user.type(await question(), 'Try again');
    expect(sendButton()).toBeEnabled();
  });

  it('shows the server refusal by the box', async () => {
    const ask = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'conflict', 'Claude is still answering.'));
    setup(makeChatDetail(), [dara], { client: { ask } });
    const user = userEvent.setup();
    await user.type(await question(), 'Again?');
    await user.click(sendButton()!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Claude is still answering.');
    expect(await question()).toHaveValue('Again?');
  });

  it('offers no Send without a helper online, and opens Connect Claude Code instead', async () => {
    const { sheets } = setup(makeChatDetail(), [makeRunner({ online: false })]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'set up your computer' }));
    expect(sheets.open).toHaveBeenCalledWith({ type: 'connect' });
    expect(sendButton()).not.toBeInTheDocument();
  });

  it('picks the helper with Run on when more than one serves the project', async () => {
    localStorage.setItem(LAST_HELPER_STORAGE_KEY, studio.id);
    const detail = makeChatDetail();
    const ask = vi.fn().mockResolvedValue(detail);
    const { client } = setup(detail, [dara, studio], { client: { ask } });
    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: /^Run on/ })).toHaveTextContent('Studio');
    await user.type(await question(), 'Hi');
    await user.click(sendButton()!);
    expect(client.ask).toHaveBeenCalledWith('c-1', {
      runnerId: studio.id,
      text: 'Hi',
      ...DEFAULT_ASK_OPTIONS,
    });
  });

  it('makes the chat with the first question and moves to its address', async () => {
    const detail = makeChatDetail({ messages: [makeMessage()], run: makeAskRun() });
    const startChat = vi.fn().mockResolvedValue(detail);
    const { client } = setup(null, [dara], { client: { startChat } });
    const user = userEvent.setup();
    expect(await screen.findByText(/Ask Claude Code on your computer/)).toBeInTheDocument();
    await user.type(await question(), 'How does sync work?');
    await user.click(sendButton()!);

    expect(client.startChat).toHaveBeenCalledWith('MOB', {
      runnerId: dara.id,
      text: 'How does sync work?',
      ...DEFAULT_ASK_OPTIONS,
    });
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask/c-1'));
    expect(await screen.findByText(`Claude is thinking on ${DARA}…`)).toBeInTheDocument();
  });

  it("goes back to the chat list for a chat that isn't there", async () => {
    setup(makeChatDetail(), [dara], {
      client: {
        getChat: vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'Not found')),
        listChats: vi.fn().mockResolvedValue([]),
      },
    });
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask'));
  });
});
