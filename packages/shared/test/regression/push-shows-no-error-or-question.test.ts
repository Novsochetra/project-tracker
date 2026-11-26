import { describe, expect, it } from 'vitest';
import { questionPush } from '../../src/logic/pushMessages';

// A lock screen shows pushes unlocked, and a question can hold secrets (PT-249).
const TICKET = { projectKey: 'MOB', num: 3, title: 'Fix the login button' };

describe('a ticket push on the lock screen', () => {
  it('says Claude has a question on the ticket and where to answer it', () => {
    expect(questionPush({ ticket: TICKET })).toEqual({
      title: 'MOB-3: Claude has a question',
      body: 'Fix the login button · Open the ticket to answer.',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });
});
