import { screen } from '@testing-library/react';
import type { ChatDetail } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChatDetail } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { renderAsk } from './test/renderAsk';

let restore: () => void;
afterEach(() => restore());

function setup(detail: ChatDetail) {
  const rendered = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
    },
  });
  restore = rendered.restore;
}

describe("Ask: how full Claude's context is", () => {
  it("shows the chat's context over the question box", async () => {
    setup(makeChatDetail({ context: { used: 70_000, window: 100_000, tokens: 300_000 } }));
    expect(await screen.findByRole('button', { name: 'Context 70%' })).toBeInTheDocument();
  });

  it('shows none for a chat whose helper sent no numbers', async () => {
    setup(makeChatDetail());
    await screen.findByRole('textbox', { name: 'Question for Claude' });
    expect(screen.queryByRole('button', { name: /^Context/ })).toBeNull();
  });
});
