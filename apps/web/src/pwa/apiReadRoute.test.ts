import { FRESH_READ_HEADER } from '@tracker/client';
import { describe, expect, it } from 'vitest';
import { isSavedApiRead } from './apiReadRoute';

const ORIGIN = 'http://localhost:5173';

function matches(path: string, headers: Record<string, string> = {}, sameOrigin = true) {
  const request = new Request(`${ORIGIN}${path}`, { headers });
  return isSavedApiRead({ url: new URL(request.url), request, sameOrigin });
}

describe('isSavedApiRead', () => {
  it('takes the API reads of this origin', () => {
    expect(matches('/api/projects')).toBe(true);
    expect(matches('/api/tickets/MOB-1')).toBe(true);
  });

  it('leaves the event stream, the app itself and other origins alone', () => {
    expect(matches('/api/events')).toBe(false);
    expect(matches('/api/projects', { accept: 'text/event-stream' })).toBe(false);
    expect(matches('/p/MOB/1')).toBe(false);
    expect(matches('/api/projects', {}, false)).toBe(false);
  });

  // Their answers keep the saved copies current; savedAnswerPlugin never answers them from it.
  it('takes fresh reads too', () => {
    expect(matches('/api/tickets/MOB-1', { [FRESH_READ_HEADER]: '1' })).toBe(true);
  });
});
