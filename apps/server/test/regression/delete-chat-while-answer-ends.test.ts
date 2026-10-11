import { randomUUID } from 'node:crypto';
import type { ChatDetail, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-159 review: a delete that raced the helper's end of the answer tried to cancel a run that had
// just ended, got 409 "This run already ended (done).", and left the chat.
describe.each(DIALECTS)('regression: deleting a chat as its answer ends (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('deletes the chat whichever lands first', async () => {
    for (let round = 0; round < 5; round += 1) {
      const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
        runnerId: runner,
        text: `Question ${round}`,
      });
      const job = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`);
      const chatId = started.body.chat.id;
      const [deleted] = await Promise.all([
        person('DELETE', `/api/chats/${chatId}`),
        helper('POST', `/api/runs/${job.body.run.id}/finish`, { status: 'done', answer: 'A' }),
      ]);
      expect(deleted.status).toBe(204);
      expect((await person('GET', `/api/chats/${chatId}`)).status).toBe(404);
    }
  });
});
