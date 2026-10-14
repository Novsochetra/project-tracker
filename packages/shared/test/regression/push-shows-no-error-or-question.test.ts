import { describe, expect, it } from 'vitest';
import { batchEndedPush, questionPush, runEndedPush } from '../../src/logic/pushMessages';

// A lock screen shows a push without unlocking, and a failed run's error (the end of the helper's
// stderr) and Claude's question can hold command output or secrets. These pushes put them in
// (PT-249), so the builders take none of that text now; test/integration in apps/server sends
// real secrets through the API and checks no push holds them.
const TICKET = { projectKey: 'MOB', num: 3, title: 'Fix the login button' };

describe('a ticket push on the lock screen', () => {
  it('says a run stopped, the ticket and where to read why', () => {
    expect(runEndedPush(TICKET, 'failed')).toEqual({
      title: 'MOB-3: Claude stopped',
      body: 'Fix the login button · Open the ticket to see why.',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('says Claude has a question on the ticket and where to answer it', () => {
    expect(questionPush({ ticket: TICKET })).toEqual({
      title: 'MOB-3: Claude has a question',
      body: 'Fix the login button · Open the ticket to answer.',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('says a Run all batch stopped with its counts and keys only', () => {
    const batch = { runId: 'r-1', projectKey: 'MOB', total: 4, notDoneKeys: ['MOB-2', 'MOB-4'] };
    expect(batchEndedPush(batch, 'failed')).toEqual({
      title: 'MOB: Run all stopped: 2 of 4 done',
      body: 'Not finished: MOB-2, MOB-4',
      url: '/activity',
      tag: 'batch:r-1',
    });
  });
});
