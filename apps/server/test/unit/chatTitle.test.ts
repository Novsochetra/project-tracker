import { CHAT_TITLE_MAX } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { chatTitle } from '../../src/services/chatMappers';

describe('chatTitle', () => {
  it('puts the question on one line', () => {
    expect(chatTitle('  Where are\n  runs   queued? ')).toBe('Where are runs queued?');
  });

  it('cuts a long question with an ellipsis', () => {
    const title = chatTitle(`${'word '.repeat(40)}end`);
    expect(title).toHaveLength(CHAT_TITLE_MAX);
    expect(title.endsWith('…')).toBe(true);
  });
});
