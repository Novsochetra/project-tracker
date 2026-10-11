import type { CreatedApiToken, ErrorBody, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addOwner, signIn } from '../helpers/auth';
import { DIALECTS, useTestServer } from '../helpers/server';

// Reviewer 100 (PT-138): an agent could call itself "User", the word agents read for the person in
// the CLI's activity, or "You", the web's. Its comments then read as the person's.
describe.each(DIALECTS)('regression: an agent named like the person (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let owner: Record<string, string> = {};
  let token = '';

  beforeEach(async () => {
    await addOwner(api.db);
    owner = { cookie: await signIn(api.app) };
    await api.post('/api/projects', { name: 'Mobile', key: 'MOB' }, { headers: owner });
    await api.post('/api/projects/MOB/tickets', { title: 'Crash' }, { headers: owner });
    const created = await api.post<CreatedApiToken>(
      '/api/tokens',
      { name: 'Claude' },
      { headers: owner },
    );
    token = created.body.secret;
  });

  const comment = (kind: 'agent' | 'human', name: string) =>
    api.post<ErrorBody>(
      '/api/tickets/MOB-1/comments',
      { text: 'Looks done to me' },
      { headers: { authorization: `Bearer ${token}` }, actor: { kind, name } },
    );

  it.each(['User', 'user', ' USER ', 'You', 'you'])(
    'refuses a token request named %j',
    async (name) => {
      const answer = await comment('agent', name);
      expect(answer.status).toBe(400);
      expect(answer.body.error.code).toBe('invalid_input');
      expect(answer.body.error.message).toBe(
        `An agent can't be called “${name.trim()}”: that is the name for the person. ` +
          'Give it another name (TRACKER_AGENT_NAME or --as).',
      );
      const ticket = await api.get<TicketDetail>('/api/tickets/MOB-1', { headers: owner });
      expect(ticket.body.activity.some((entry) => entry.type === 'comment')).toBe(false);
    },
  );

  it('refuses it too when the token says it is the person', async () => {
    expect((await comment('human', 'User')).status).toBe(400);
  });

  it('keeps other agent names, ones that only contain the word included', async () => {
    expect((await comment('agent', 'Claude user helper')).status).toBe(201);
    expect((await comment('agent', 'Youssef')).status).toBe(201);
  });

  it('lets the owner name itself as it likes', async () => {
    const answer = await api.post(
      '/api/tickets/MOB-1/comments',
      { text: 'Mine' },
      { headers: owner, actor: { kind: 'human', name: 'User' } },
    );
    expect(answer.status).toBe(201);
  });
});

// The local tracker without an owner takes the actor header as sent, so the name is checked there too.
describe.each(DIALECTS)('regression: an agent named like the person, no owner (%s)', (dialect) => {
  const api = useTestServer(dialect, { auth: { openWithoutOwner: 'local' } });

  beforeEach(async () => {
    await api.post('/api/projects', { name: 'Mobile', key: 'MOB' });
    await api.post('/api/projects/MOB/tickets', { title: 'Crash' });
  });

  const comment = (kind: 'agent' | 'human', name: string) =>
    api.post<ErrorBody>(
      '/api/tickets/MOB-1/comments',
      { text: 'Looks done to me' },
      { actor: { kind, name } },
    );

  it.each(['User', 'you', 'ＵＳＥＲ', 'User​'])(
    'refuses an agent header naming %j',
    async (name) => {
      const answer = await comment('agent', name);
      expect(answer.status).toBe(400);
      expect(answer.body.error.code).toBe('invalid_input');
    },
  );

  it('lets the person be User, and other agents in', async () => {
    expect((await comment('human', 'User')).status).toBe(201);
    expect((await comment('agent', 'Claude')).status).toBe(201);
  });
});
