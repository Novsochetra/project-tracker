import { describe, expect, it } from 'vitest';
import {
  chatAnsweredPush,
  chatPath,
  reviewedPush,
  runEndedPush,
  ticketPath,
} from '../src/logic/pushMessages';

const TICKET = { projectKey: 'MOB', num: 3, title: 'Fix the login button' };

describe('push messages', () => {
  it('says a ticket run finished and opens the ticket', () => {
    expect(runEndedPush(TICKET, null)).toEqual({
      title: 'MOB-3: Claude finished',
      body: 'Fix the login button',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('says why a ticket run stopped', () => {
    expect(runEndedPush(TICKET, 'That computer was removed.').title).toBe(
      'MOB-3: Claude stopped: That computer was removed.',
    );
  });

  it('says a reviewed ticket is ready with its rating, under the same tag as its run', () => {
    expect(reviewedPush(TICKET, 4)).toEqual({
      title: 'MOB-3 is ready for you · 4/5',
      body: 'Fix the login button',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('shows the start of a chat answer on one line and opens the chat', () => {
    const chat = { projectKey: 'MOB', chatId: 'c-1', title: 'Login bug' };
    expect(chatAnsweredPush(chat, 'It is in\n\n  `auth.ts`.')).toEqual({
      title: 'Claude answered: Login bug',
      body: 'It is in `auth.ts`.',
      url: '/p/MOB/ask/c-1',
      tag: 'chat:c-1',
    });
    expect(chatAnsweredPush({ ...chat, title: ' ' }, 'Yes').title).toBe('Claude answered');
  });

  it('cuts long text by code point, so an emoji is never split', () => {
    const body = runEndedPush({ ...TICKET, title: `${'a'.repeat(298)}😀😀😀` }, null).body;
    expect([...body]).toHaveLength(300);
    expect(body.endsWith('a😀…')).toBe(true);
  });

  it('escapes keys and ids in paths', () => {
    expect(ticketPath('MOB', 12)).toBe('/p/MOB/12');
    expect(chatPath('MOB', 'a/b')).toBe('/p/MOB/ask/a%2Fb');
  });
});
