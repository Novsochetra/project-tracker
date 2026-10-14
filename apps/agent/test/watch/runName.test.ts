import { describe, expect, it } from 'vitest';
import { runName } from '../../src/watch/runName';

describe('runName', () => {
  it('names a ticket run by its ticket, a question by its chat and a batch by its project', () => {
    const base = { projectKey: 'MOB', ticketKey: null, chatId: null };
    expect(runName({ ...base, kind: 'ticket', ticketKey: 'MOB-3' })).toBe('MOB-3');
    expect(runName({ ...base, kind: 'ask', chatId: '1234567890' })).toBe('chat 12345678');
    expect(runName({ ...base, kind: 'batch' })).toBe('MOB batch');
  });
});
