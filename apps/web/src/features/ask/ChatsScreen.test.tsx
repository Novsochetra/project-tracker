import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChat } from '../../api/test/chatFixtures';
import { currentPath } from '../../app/test/harness';
import { renderAsk } from './test/renderAsk';

let restore: () => void;

afterEach(() => restore());

function setup(chats = [makeChat()], phone = false) {
  const rendered = renderAsk({
    path: '/p/MOB/ask',
    phone,
    client: { listChats: vi.fn().mockResolvedValue(chats) },
  });
  restore = rendered.restore;
  return rendered;
}

describe('Ask: the chat list', () => {
  it('lists the chats as the tracker orders them, newest first, and opens one', async () => {
    const hour = 60 * 60 * 1000;
    setup([
      makeChat({ id: 'c-2', title: 'Where is the login code?', updatedAt: Date.now() - hour }),
      makeChat({ id: 'c-1', title: 'How does sync work?', updatedAt: Date.now() - 2 * 24 * hour }),
    ]);
    const user = userEvent.setup();
    const list = await screen.findByRole('region', { name: 'Chats' });
    const rows = within(list).getAllByRole('button', { name: /ago$/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Where is the login code\? 1h ago/),
      expect.stringMatching(/^How does sync work\? 2d ago/),
    ]);
    await user.click(rows[0]!);
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask/c-2'));
  });

  it('says which chat waits for an answer in place of its time', async () => {
    setup([
      makeChat({ id: 'c-2', title: 'Rename the queue', waiting: true }),
      makeChat({ id: 'c-1', title: 'How does sync work?' }),
    ]);
    const list = await screen.findByRole('region', { name: 'Chats' });
    const rows = within(list)
      .getAllByRole('button')
      .filter((row) => !row.hasAttribute('aria-expanded'));
    expect(rows[0]).toHaveAccessibleName('Rename the queue Claude is waiting for you');
    expect(within(rows[0]!).getByText('Waiting for you')).toBeVisible();
    expect(rows[0]).not.toHaveTextContent(/ago/);
    expect(rows[1]).toHaveTextContent(/^How does sync work\? 1m ago/);
  });

  it('says the list is empty without a New chat of its own', async () => {
    setup([]);
    const title = await screen.findByText('No chats yet');
    expect(within(title.parentElement!).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull();
  });

  it('starts the first chat from the bottom bar on phones', async () => {
    setup([], true);
    const user = userEvent.setup();
    await screen.findByText('No chats yet');
    const [newChat, ...others] = screen.getAllByRole('button', { name: 'New chat' });
    expect(others).toEqual([]);
    expect(newChat!.closest('[data-bottom-bar]')).not.toBeNull();
    await user.click(newChat!);
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask/new'));
  });

  it('keeps New chat in the bottom bar on phones, within reach of a thumb', async () => {
    setup([makeChat()], true);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Chats' });
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask/new'));
  });
});
