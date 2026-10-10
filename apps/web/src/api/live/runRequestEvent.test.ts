import { describe, expect, it } from 'vitest';
import { parseRunRequestEvent } from './changeEvent';

const request = {
  type: 'run-request',
  runId: 'r1',
  requestId: 'q1',
  projectId: 'p',
  ticketId: 't',
  chatId: null,
  status: 'open',
};

describe('parseRunRequestEvent', () => {
  it("reads request events of a ticket's run and of a chat's, in every status", () => {
    expect(parseRunRequestEvent(JSON.stringify(request))).toEqual(request);
    const ask = { ...request, ticketId: null, chatId: 'c1', status: 'expired' };
    expect(parseRunRequestEvent(JSON.stringify(ask))).toEqual(ask);
  });

  it('ignores anything else', () => {
    expect(parseRunRequestEvent(JSON.stringify({ ...request, type: 'run-step' }))).toBeNull();
    expect(parseRunRequestEvent(JSON.stringify({ ...request, status: 'waiting' }))).toBeNull();
    expect(parseRunRequestEvent(JSON.stringify({ ...request, requestId: '' }))).toBeNull();
    expect(parseRunRequestEvent(JSON.stringify({ ...request, runId: 7 }))).toBeNull();
    expect(parseRunRequestEvent('not json')).toBeNull();
  });
});
