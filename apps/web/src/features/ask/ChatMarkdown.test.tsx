import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChatDetail, makeMessage, ticketCardText } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { renderAsk } from './test/renderAsk';

let restore: () => void;

afterEach(() => restore());

function showChat(...messages: Array<{ role: 'person' | 'claude'; text: string }>) {
  const detail = makeChatDetail({
    messages: messages.map((message, index) => makeMessage({ id: `m-${index + 1}`, ...message })),
  });
  restore = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
    },
  }).restore;
}

describe('Ask: formatted answers', () => {
  it("formats Claude's answers and leaves the person's words as written", async () => {
    showChat(
      { role: 'person', text: 'Is **this** bold?' },
      { role: 'claude', text: '## Yes\n\n- **one**\n- two' },
    );
    const claude = await screen.findByRole('article', { name: 'Claude' });
    expect(within(claude).getByRole('heading', { name: 'Yes' })).toBeVisible();
    expect(within(claude).getAllByRole('listitem')).toHaveLength(2);
    expect(within(claude).getByText('one').tagName).toBe('STRONG');
    expect(screen.getByRole('article', { name: 'You' })).toHaveTextContent('Is **this** bold?');
  });

  it('formats the text around a ticket card and keeps the card', async () => {
    const card = ticketCardText('Sync faster');
    showChat({ role: 'claude', text: `## Plan\n\n${card}\n\n**Tap Create** when ready.` });
    const claude = await screen.findByRole('article', { name: 'Claude' });
    expect(within(claude).getByRole('heading', { name: 'Plan' })).toBeVisible();
    expect(within(claude).getByRole('region', { name: 'Ticket card' })).toBeVisible();
    expect(within(claude).getByText('Tap Create').tagName).toBe('STRONG');
  });
});
