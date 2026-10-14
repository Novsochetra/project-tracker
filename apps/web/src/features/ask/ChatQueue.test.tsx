import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_ASK_OPTIONS, type ChatDetail, type QueuedMessage } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAskRun, makeChatDetail } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { renderAsk } from './test/renderAsk';

const queuedMessage = (overrides: Partial<QueuedMessage> = {}): QueuedMessage => ({
  id: 'q-1',
  text: 'And the tests?',
  attachments: [],
  options: DEFAULT_ASK_OPTIONS,
  held: false,
  createdAt: Date.now(),
  ...overrides,
});

const running = makeAskRun({ status: 'running', startedAt: Date.now(), runnerId: 'h-studio' });
const stopped = { ...running, status: 'cancelled' as const, endedAt: Date.now() };
const queuedItem = (text: string) => screen.findByRole('article', { name: `Queued: ${text}` });

let restore: () => void = () => undefined;
beforeEach(() => localStorage.clear());
afterEach(() => restore());

// The chat is read again after each change, and then says what the change made.
function setup(detail: ChatDetail, client: Record<string, unknown> = {}, after = detail) {
  const runners = [makeRunner(), makeRunner({ id: 'h-studio', name: 'Studio' })];
  const rendered = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValueOnce(detail).mockResolvedValue(after),
      listRunners: vi.fn().mockResolvedValue(runners),
      ...client,
    },
  });
  restore = rendered.restore;
  return rendered;
}

describe('Ask: messages queued while Claude answers', () => {
  it('sends a message typed while Claude answers to the helper answering', async () => {
    const queued = makeChatDetail({
      run: running,
      queued: [queuedMessage({ text: 'And offline?' })],
    });
    const ask = vi.fn().mockResolvedValue(queued);
    setup(makeChatDetail({ run: running }), { ask }, queued);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Question for Claude' }),
      'And offline?',
    );
    await user.click(await screen.findByRole('button', { name: 'Send' }));
    expect(ask).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({ runnerId: 'h-studio', text: 'And offline?' }),
    );
    expect(await queuedItem('And offline?')).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeEnabled();
  });

  it('shows each queued message with Queued, Edit and Remove, but no Send now while Claude works', async () => {
    setup(makeChatDetail({ run: running, queued: [queuedMessage()] }));
    const item = within(await queuedItem('And the tests?'));
    expect(item.getByText('Queued')).toBeVisible();
    expect(item.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(item.getByRole('button', { name: 'Remove' })).toBeEnabled();
    expect(item.queryByRole('button', { name: 'Send now' })).not.toBeInTheDocument();
  });

  it('edits a queued message in place', async () => {
    const edited = makeChatDetail({
      run: running,
      queued: [queuedMessage({ text: 'And the e2e tests?' })],
    });
    const editQueued = vi.fn().mockResolvedValue(edited);
    setup(makeChatDetail({ run: running, queued: [queuedMessage()] }), { editQueued }, edited);
    const user = userEvent.setup();
    await user.click(
      within(await queuedItem('And the tests?')).getByRole('button', { name: 'Edit' }),
    );
    const field = screen.getByRole('textbox', { name: 'Queued message' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'And the e2e tests?');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(editQueued).toHaveBeenCalledWith('c-1', 'q-1', { text: 'And the e2e tests?' });
    expect(await queuedItem('And the e2e tests?')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Queued message' })).not.toBeInTheDocument();
  });

  it('removes a queued message', async () => {
    const removeQueued = vi.fn().mockResolvedValue(makeChatDetail({ run: running, queued: [] }));
    setup(makeChatDetail({ run: running, queued: [queuedMessage()] }), { removeQueued });
    await userEvent
      .setup()
      .click(within(await queuedItem('And the tests?')).getByRole('button', { name: 'Remove' }));
    expect(removeQueued).toHaveBeenCalledWith('c-1', 'q-1');
  });

  it('offers Send now once Claude stopped, which starts that message', async () => {
    const sendQueuedNow = vi.fn().mockResolvedValue(makeChatDetail({ run: running, queued: [] }));
    setup(makeChatDetail({ run: stopped, queued: [queuedMessage({ held: true })] }), {
      sendQueuedNow,
    });
    expect(within(await queuedItem('And the tests?')).getByText('Not sent')).toBeVisible();
    await userEvent
      .setup()
      .click(within(await queuedItem('And the tests?')).getByRole('button', { name: 'Send now' }));
    expect(sendQueuedNow).toHaveBeenCalledWith('c-1', 'q-1');
  });
});
