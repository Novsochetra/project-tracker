import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChat } from '../../api/test/chatFixtures';
import { currentPath } from '../../app/test/harness';
import { readMenuConfirm } from '../../components/Popover/testing';
import { renderAsk } from './test/renderAsk';

const QUESTION = 'Delete this chat? Its messages are gone for good. Tickets made from it stay.';
const CHATS = [
  makeChat({ id: 'c-2', title: 'Where is the login code?' }),
  makeChat({ id: 'c-1', title: 'How does sync work?' }),
];

let restore: () => void;

afterEach(() => restore());

function setup(phone: boolean, deleteChat = vi.fn().mockResolvedValue(undefined)) {
  const listChats = vi.fn().mockResolvedValue(CHATS);
  const rendered = renderAsk({ path: '/p/MOB/ask', phone, client: { listChats, deleteChat } });
  restore = rendered.restore;
  return { deleteChat, listChats };
}

const chatRow = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^${title.replace('?', '\\?')}`) });

// Swipe gestures need real touch input; the actions they reveal are plain buttons underneath.
function swipeDelete(title: string) {
  const row = chatRow(title).closest<HTMLElement>('[data-chat-row]');
  if (!row) throw new Error(`No row for ${title}`);
  fireEvent.click(within(row).getByText('Delete').closest('button')!);
}

describe('Ask: deleting a chat from the list on a phone', () => {
  it('swipes left to Delete, asks, deletes and stays on the list with a toast', async () => {
    const { deleteChat, listChats } = setup(true);
    await screen.findByRole('region', { name: 'Chats' });
    listChats.mockResolvedValue([CHATS[1]]);
    swipeDelete('Where is the login code?');
    const sheet = await screen.findByRole('dialog', { name: 'Delete chat' });
    expect(sheet).toHaveTextContent(QUESTION);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete chat' }));
    expect(await screen.findByText('Chat deleted')).toBeInTheDocument();
    expect(deleteChat).toHaveBeenCalledWith('c-2');
    await waitFor(() =>
      expect(screen.queryByText('Where is the login code?')).not.toBeInTheDocument(),
    );
    expect(chatRow('How does sync work?')).toBeVisible();
    expect(currentPath()).toBe('/p/MOB/ask');
  });

  it('keeps the chat when the sheet is cancelled', async () => {
    const { deleteChat } = setup(true);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Chats' });
    swipeDelete('How does sync work?');
    const sheet = await screen.findByRole('dialog', { name: 'Delete chat' });
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(deleteChat).not.toHaveBeenCalled();
    expect(chatRow('How does sync work?')).toBeVisible();
  });

  it('shows why a delete failed, and asks afresh on the next swipe', async () => {
    setup(true, vi.fn().mockRejectedValue(new ApiError(500, 'internal', 'Database is locked')));
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Chats' });
    swipeDelete('How does sync work?');
    const sheet = await screen.findByRole('dialog', { name: 'Delete chat' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete chat' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Database is locked');
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    swipeDelete('Where is the login code?');
    const again = await screen.findByRole('dialog', { name: 'Delete chat' });
    expect(again).toHaveTextContent(QUESTION);
    expect(within(again).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no ••• on the rows, which swipe instead', async () => {
    setup(true);
    await screen.findByRole('region', { name: 'Chats' });
    expect(screen.queryByRole('button', { name: /^Options for/ })).not.toBeInTheDocument();
  });
});

describe('Ask: deleting a chat from the list on a desktop', () => {
  it('deletes from the row’s ••• after asking, and moves focus to the next chat', async () => {
    const { deleteChat, listChats } = setup(false);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Chats' });
    listChats.mockResolvedValue([CHATS[1]]);
    await user.click(screen.getByRole('button', { name: 'Options for Where is the login code?' }));
    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    expect(screen.getByRole('alert')).toHaveTextContent(QUESTION);
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Chat deleted')).toBeInTheDocument();
    expect(deleteChat).toHaveBeenCalledWith('c-2');
    await waitFor(() =>
      expect(screen.queryByText('Where is the login code?')).not.toBeInTheDocument(),
    );
    expect(chatRow('How does sync work?')).toHaveFocus();
    expect(currentPath()).toBe('/p/MOB/ask');
  });

  it('shows why a delete failed and keeps the chat', async () => {
    setup(false, vi.fn().mockRejectedValue(new ApiError(500, 'internal', 'Database is locked')));
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Chats' });
    await user.click(screen.getByRole('button', { name: 'Options for How does sync work?' }));
    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Database is locked')).toBeVisible();
    expect(chatRow('How does sync work?')).toBeVisible();
  });
});
