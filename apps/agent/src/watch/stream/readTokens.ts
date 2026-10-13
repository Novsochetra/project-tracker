import { isJson } from '@tracker/shared';

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

// Every token a call read, cached or not. Output tokens are left out: a streamed message shows
// them before it ends.
export const readTokensOf = (input: unknown, cacheRead: unknown, cacheWrite: unknown): number =>
  count(input) + count(cacheRead) + count(cacheWrite);

// What this run's own calls read, from the messages it streamed: a message shows once for each of
// its parts, so each counts once.
export function createReadTokenCount() {
  const byMessage = new Map<string, number>();
  return {
    add(event: unknown) {
      if (!isJson(event) || event.type !== 'assistant' || !isJson(event.message)) return;
      const { id, usage } = event.message;
      if (typeof id !== 'string' || !isJson(usage)) return;
      byMessage.set(
        id,
        readTokensOf(
          usage.input_tokens,
          usage.cache_read_input_tokens,
          usage.cache_creation_input_tokens,
        ),
      );
    },
    total: () => [...byMessage.values()].reduce((total, tokens) => total + tokens, 0),
  };
}
