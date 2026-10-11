import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChat, makeChatDetail } from '../../api/test/chatFixtures';
import { currentPath } from '../../app/test/harness';
import { renderAsk } from './test/renderAsk';

const QUESTION = 'Delete this chat? Its messages are gone for good. Tickets made from it stay.';

let restore: () => void;

afterEach(() => restore());

function setup(deleteChat = vi.fn().mockResolvedValue(undefined), path = '/p/MOB/ask/c-1') {
  const rendered = renderAsk({
    path,
    phone: true,
    client: {
      getChat: vi.fn().mockResolvedValue(makeChatDetail()),
      listChats: vi.fn().mockResolvedValue([makeChat()]),
      listRunners: vi.fn().mockResolvedValue([]),
      deleteChat,
    },
  });
  restore = rendered.restore;
  return deleteChat;
}

async function askToDelete() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Chat options' }));
  await user.click(screen.getByRole('button', { name: 'Delete chat' }));
  expect(screen.getByRole('alert')).toHaveTextContent(QUESTION);
  return user;
}

describe('Ask: deleting a chat on a phone', () => {
  it('asks first, then deletes the chat and goes back to the list with a toast', async () => {
    const deleteChat = setup();
    const user = await askToDelete();
    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    expect(deleteChat).toHaveBeenCalledWith('c-1');
    expect(await screen.findByText('Chat deleted')).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask'));
  });

  it('shows why a delete failed and stays on the chat', async () => {
    setup(vi.fn().mockRejectedValue(new ApiError(500, 'internal', 'Database is locked')));
    const user = await askToDelete();
    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    expect(await screen.findByText('Database is locked')).toBeInTheDocument();
    expect(currentPath()).toBe('/p/MOB/ask/c-1');
  });

  it('has nothing to delete before the first question', async () => {
    setup(undefined, '/p/MOB/ask/new');
    expect(await screen.findByRole('textbox', { name: 'Question for Claude' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Chat options' })).not.toBeInTheDocument();
  });
});
