import { describe, expect, it } from 'vitest';
import { createReadTokenCount } from '../../../src/watch/stream/readTokens';

const message = (id: string, usage: unknown) => ({
  type: 'assistant',
  message: { id, role: 'assistant', content: [], usage },
});

describe('createReadTokenCount', () => {
  it('counts each message once, its input and cache reads and writes, not its output', () => {
    const count = createReadTokenCount();
    const first = {
      input_tokens: 2,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 30,
    };
    count.add(message('m-1', { ...first, output_tokens: 1 }));
    count.add(message('m-1', { ...first, output_tokens: 400 }));
    count.add(message('m-2', { input_tokens: 5, output_tokens: 9 }));
    expect(count.total()).toBe(137);
  });

  it('skips other events and messages without usage', () => {
    const count = createReadTokenCount();
    count.add({ type: 'user', message: { id: 'u', usage: { input_tokens: 9 } } });
    count.add({ type: 'assistant', message: { id: 'm-1' } });
    count.add({ type: 'assistant' });
    count.add(null);
    expect(count.total()).toBe(0);
  });
});
