import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatRunner } from '../../../src/watch/chat/chatRunner';
import { askJob } from '../fakeTracker';
import { fakeSpawn, SESSION, type FakeChatChild } from './fakeChatChild';

const running: { closeAll: () => void }[] = [];
afterEach(() => running.splice(0).forEach((chats) => chats.closeAll()));

const message = (id: string, cacheRead: number, parent: string | null = null) => ({
  type: 'assistant',
  parent_tool_use_id: parent,
  message: {
    id,
    model: 'claude-opus-5-5',
    usage: { input_tokens: 2, cache_read_input_tokens: cacheRead },
  },
});

// modelUsage is the open process's running total, so its tokens are of no use for one turn.
const result = (inputTokens: number) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'Yes.',
  usage: { input_tokens: 2, cache_read_input_tokens: 1_000, output_tokens: 50 },
  modelUsage: { 'claude-opus-5-5': { inputTokens, contextWindow: 200_000 } },
});

async function turn(
  chats: ReturnType<typeof createChatRunner>,
  children: FakeChatChild[],
  id: string,
  events: object[],
) {
  const prompt = `Q ${id}`;
  const exit = chats.ask(
    { ...askJob(id, 'chat-1', id === 'r-1' ? null : SESSION), prompt },
    new AbortController().signal,
    () => undefined,
  );
  await vi.waitFor(() => expect(children[0]?.messages().at(-1)).toBe(prompt));
  const child = children[0]!;
  child.begin();
  events.forEach((event) => child.print(event));
  child.state('idle');
  return exit;
}

describe("a chat turn's context", () => {
  it("is the turn's own last main message, and a compaction starts it again", async () => {
    const { spawn, children } = fakeSpawn();
    const chats = createChatRunner({ command: 'claude', cwd: '/repo', limit: [], spawn });
    running.push(chats);
    const first = await turn(chats, children, 'r-1', [
      message('m-1', 150_000),
      message('m-2', 9_000, 'tool-1'),
      result(1_000_000),
    ]);
    expect(first.context).toEqual({ used: 150_002, window: 200_000 });
    const second = await turn(chats, children, 'r-2', [
      {
        type: 'system',
        subtype: 'compact_boundary',
        compact_metadata: { pre_tokens: 160_000, post_tokens: 8_000 },
      },
      result(2_000_000),
    ]);
    expect(second.context).toEqual({ used: 8_000, window: 200_000 });
    expect(second.results.at(-1)?.usage?.tokens).toBe(1_052);
  });
});
