import { describe, expect, it } from 'vitest';
import { questionPush, reviewedPush, ticketPath } from '../src/logic/pushMessages';

const TICKET = { projectKey: 'MOB', num: 3, title: 'Fix the login button' };

describe('push messages', () => {
  it('says a reviewed ticket is ready with its rating, under the ticket’s tag', () => {
    expect(reviewedPush(TICKET, 4)).toEqual({
      title: 'MOB-3 is ready for you · 4/5',
      body: 'Fix the login button',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('says an agent has a question on a ticket, under the ticket’s tag', () => {
    expect(questionPush({ ticket: TICKET })).toEqual({
      title: 'MOB-3: An agent has a question',
      body: 'Fix the login button · Open the ticket to answer.',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('cuts long text by code point, so an emoji is never split', () => {
    const body = reviewedPush({ ...TICKET, title: `${'a'.repeat(298)}😀😀😀` }, 4).body;
    expect([...body]).toHaveLength(300);
    expect(body.endsWith('a😀…')).toBe(true);
  });

  it('opens the ticket by its key and number', () => {
    expect(ticketPath('MOB', 12)).toBe('/p/MOB/12');
  });
});
