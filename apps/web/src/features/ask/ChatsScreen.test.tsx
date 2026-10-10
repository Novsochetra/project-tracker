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
    const rows = within(list).getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Where is the login code\? 1h ago/),
      expect.stringMatching(/^How does sync work\? 2d ago/),
    ]);
    await user.click(rows[0]!);
    await waitFor(() => expect(currentPath()).toBe('/p/MOB/ask/c-2'));
  });

  it('starts a new chat from the empty list', async () => {
    setup([]);
    const user = userEvent.setup();
    expect(await screen.findByText('No chats yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New chat' }));
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
