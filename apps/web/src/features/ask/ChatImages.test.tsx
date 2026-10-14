import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatDetail, ChatMessage } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { attachment } from '../../api/test/fixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { renderAsk } from './test/renderAsk';

const CARD = '````image\npath: docs/home.png\n````';

let restore: () => void;

afterEach(() => restore());

function showAnswer(answer: Partial<ChatMessage>) {
  const detail = makeChatDetail();
  const message = makeMessage({ id: 'm-claude', role: 'claude', ...answer });
  const shown: ChatDetail = { ...detail, messages: [...detail.messages, message] };
  const rendered = renderAsk({
    path: `/p/MOB/ask/${detail.chat.id}`,
    client: {
      getChat: vi.fn().mockResolvedValue(shown),
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
    },
  });
  restore = rendered.restore;
}

const claudeAnswer = async () => {
  const messages = await screen.findByRole('list', { name: 'Messages' });
  return within(messages).getAllByRole('article', { name: 'Claude' }).at(-1)!;
};

describe("Ask: pictures in Claude's answer (PT-225)", () => {
  it('shows the picture under the words, without its card, and opens it full size', async () => {
    const home = attachment('home', { ticketId: null, width: 1170, height: 2532 });
    showAnswer({
      text: `Here is the home screen:\n\n${CARD}\n\nTap it to zoom.`,
      attachments: [home],
    });
    const answer = await claudeAnswer();
    expect(answer).toHaveTextContent('Here is the home screen:');
    expect(answer).toHaveTextContent('Tap it to zoom.');
    expect(answer).not.toHaveTextContent('path: docs/home.png');
    const open = within(answer).getByRole('button', { name: 'Open image 1' });
    const picture = open.querySelector('img');
    expect(picture).toHaveAttribute('src', home.url);
    expect(picture).toHaveAttribute('width', '1170');
    const user = userEvent.setup();
    await user.click(open);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows several pictures in order, each opening its own', async () => {
    const pictures = [attachment('one', { ticketId: null }), attachment('two', { ticketId: null })];
    showAnswer({ text: `Two:\n${CARD}\n${CARD}`, attachments: pictures });
    const answer = await claudeAnswer();
    expect(within(answer).getByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
    expect(within(answer).getByRole('button', { name: 'Open image 2' })).toBeInTheDocument();
  });

  it('shows an answer of words only as before, with no picture', async () => {
    showAnswer({ text: 'Sync runs **every minute**.' });
    const answer = await claudeAnswer();
    expect(answer).toHaveTextContent('Sync runs every minute.');
    expect(within(answer).queryByRole('button', { name: /^Open/ })).toBeNull();
  });

  it('keeps ticket cards working beside a picture', async () => {
    const card = '````ticket\ntitle: Fix sync\npriority: high\n---\n## Why\nIt drops edits.\n````';
    const home = attachment('home', { ticketId: null });
    showAnswer({ text: `Look:\n${CARD}\n\n${card}`, attachments: [home] });
    const answer = await claudeAnswer();
    expect(within(answer).getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(within(answer).getByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
    expect(answer).not.toHaveTextContent('path: docs/home.png');
  });
});
