import { describe, expect, it } from 'vitest';
import { parseChatDeletedEvent } from './changeEvent';

const deleted = { type: 'chat-deleted', chatId: 'c1', projectId: 'p' };

describe('parseChatDeletedEvent', () => {
  it('reads which chat went', () => {
    expect(parseChatDeletedEvent(JSON.stringify(deleted))).toEqual(deleted);
  });

  it('ignores anything else', () => {
    expect(parseChatDeletedEvent(JSON.stringify({ ...deleted, type: 'run' }))).toBeNull();
    expect(parseChatDeletedEvent(JSON.stringify({ ...deleted, chatId: '' }))).toBeNull();
    expect(parseChatDeletedEvent(JSON.stringify({ ...deleted, projectId: 7 }))).toBeNull();
    expect(parseChatDeletedEvent('not json')).toBeNull();
  });
});
