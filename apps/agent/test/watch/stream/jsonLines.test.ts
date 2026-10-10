import { describe, expect, it } from 'vitest';
import { createJsonLines } from '../../../src/watch/stream/jsonLines';

function reader() {
  const events: unknown[] = [];
  const texts: string[] = [];
  const lines = createJsonLines({
    onEvent: (event) => events.push(event),
    onText: (text) => texts.push(text),
  });
  return { lines, events, texts };
}

describe('createJsonLines', () => {
  it('reads a line only once it is whole, however the chunks split it', () => {
    const { lines, events } = reader();
    lines.push('{"type":"assi');
    expect(events).toEqual([]);
    lines.push('stant","n":1}\n{"type":"result"');
    expect(events).toEqual([{ type: 'assistant', n: 1 }]);
    lines.push(',"n":2}\n\n{"type":"x"}');
    lines.end();
    expect(events).toEqual([{ type: 'assistant', n: 1 }, { type: 'result', n: 2 }, { type: 'x' }]);
  });

  it('keeps a character split across chunks whole', () => {
    const { lines, events } = reader();
    lines.push('{"text":"caf');
    lines.push('é ✓"}\r\n');
    expect(events).toEqual([{ text: 'café ✓' }]);
  });

  it('hands on lines that are no JSON event as text, and skips blank ones', () => {
    const { lines, events, texts } = reader();
    lines.push('Warning: something\n   \n{not json}\n[1,2]\n{"ok":true}\n');
    expect(texts).toEqual(['Warning: something', '{not json}', '[1,2]']);
    expect(events).toEqual([{ ok: true }]);
  });
});
