export interface SseMessage {
  event: string;
  data: string;
}

export function createSseParser(onMessage: (message: SseMessage) => void) {
  let rest = '';
  let event = 'message';
  let data: string[] = [];

  const readLine = (line: string) => {
    if (line === '') {
      if (data.length > 0) onMessage({ event, data: data.join('\n') });
      event = 'message';
      data = [];
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    if (field === 'data') data.push(value);
  };

  return (chunk: string) => {
    const text = rest + chunk;
    // A CR at the end may be the first half of a CRLF the next chunk ends.
    const heldCr = text.endsWith('\r') ? '\r' : '';
    const lines = text.slice(0, text.length - heldCr.length).split(/\r\n|\r|\n/);
    rest = (lines.pop() ?? '') + heldCr;
    lines.forEach(readLine);
  };
}
