import { describe, expect, it } from 'vitest';
import { createSseParser, type SseMessage } from '../../src/watch/sse';

const parse = (...chunks: string[]): SseMessage[] => {
  const messages: SseMessage[] = [];
  const feed = createSseParser((message) => messages.push(message));
  chunks.forEach(feed);
  return messages;
};

describe('createSseParser', () => {
  it('reads named and plain events, and skips comments', () => {
    expect(parse(': connected\n\nevent: run\ndata: {"a":1}\n\ndata: x\n\n')).toEqual([
      { event: 'run', data: '{"a":1}' },
      { event: 'message', data: 'x' },
    ]);
  });

  it('joins an event split across chunks, whatever the line endings', () => {
    expect(parse('event: ru', 'n\r\ndata: one\r', '\ndata: two\r\n', '\r\n')).toEqual([
      { event: 'run', data: 'one\ntwo' },
    ]);
  });

  it('hands on a ping, which has empty data', () => {
    expect(parse('event: ping\ndata: \n\n')).toEqual([{ event: 'ping', data: '' }]);
  });
});
