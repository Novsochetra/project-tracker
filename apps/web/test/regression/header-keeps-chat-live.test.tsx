import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useChat } from '../../src/api/hooks/chats';
import { queryKeys } from '../../src/api/queryKeys';
import { makeChat, makeChatDetail, makeMessage } from '../../src/api/test/chatFixtures';
import { DesktopHeader } from '../../src/app/DesktopHeader';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';

function ChatText() {
  const chat = useChat('c-1');
  return <p>{chat.data?.messages.at(-1)?.text}</p>;
}

function WidenedWindow() {
  const [wide, setWide] = useState(false);
  return (
    <>
      <ChatText />
      {wide ? <DesktopHeader /> : <button onClick={() => setWide(true)}>Widen</button>}
    </>
  );
}

// PT-250: the header watched the chat with a skipToken read. Mounted after the chat screen (a
// resize from phone to desktop width), its options won, so a live refresh fetched nothing.
describe('regression: the desktop header and a live chat', () => {
  it('lets the chat read again after the header mounts', async () => {
    const chat = makeChat({ title: 'Sync' });
    const answer = makeMessage({ id: 'm-2', role: 'claude', text: 'Done' });
    const getChat = vi
      .fn()
      .mockResolvedValueOnce(makeChatDetail({ chat }))
      .mockResolvedValue(makeChatDetail({ chat, messages: [makeMessage(), answer] }));
    const user = userEvent.setup();
    const { queryClient } = renderWithApp(<WidenedWindow />, {
      path: '/p/MOB/ask/c-1',
      projects: [projectSummary()],
      client: { getChat },
    });
    expect(await screen.findByText('It reads the queue every minute.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Widen' }));
    expect(await screen.findByText('Sync')).toBeInTheDocument();
    await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.chat('c-1') }));
    expect(await screen.findByText('Done')).toBeInTheDocument();
  });
});
