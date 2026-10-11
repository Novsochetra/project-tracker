import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshForChatDeleted } from '../../src/api/live/refreshForChat';
import { makeChat, makeChatDetail } from '../../src/api/test/chatFixtures';
import { currentPath } from '../../src/app/test/harness';
import { renderAsk } from '../../src/features/ask/test/renderAsk';
import { readMenuConfirm } from '../../src/components/Popover/testing';

const gone = () => new ApiError(404, 'not_found', 'That chat was not found.');

let restore: () => void;

afterEach(() => restore());

function setup(deleteChat = vi.fn()) {
  const rendered = renderAsk({
    path: '/p/MOB/ask/c-1',
    phone: true,
    client: {
      getChat: vi.fn().mockResolvedValueOnce(makeChatDetail()).mockRejectedValue(gone()),
      listChats: vi.fn().mockResolvedValueOnce([makeChat()]).mockResolvedValue([]),
      listRunners: vi.fn().mockResolvedValue([]),
      deleteChat,
    },
  });
  restore = rendered.restore;
  return rendered;
}

// PT-159 review: a chat deleted in another tab or on another device stayed open here, and a
// question or a delete there said "That chat was not found."
describe('regression: a chat deleted somewhere else', () => {
  it('leaves the open chat for the list when the tracker says it was deleted', async () => {
    const { queryClient } = setup();
    expect(await screen.findByRole('button', { name: 'Chat options' })).toBeVisible();
    act(() =>
      refreshForChatDeleted(queryClient, { type: 'chat-deleted', chatId: 'c-1', projectId: 'p' }),
    );
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask'));
  });

  it('takes a delete the tracker no longer finds as done', async () => {
    setup(vi.fn().mockRejectedValue(gone()));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Chat options' }));
    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    expect(await screen.findByText('Chat deleted')).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask'));
  });
});
