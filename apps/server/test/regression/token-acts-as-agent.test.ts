import type { CreatedApiToken, ErrorBody, ProjectDetail, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addOwner, JSON_HEADERS, signIn } from '../helpers/auth';
import { useTestServer } from '../helpers/server';

// Reviewer 100: a request with an API token could send X-Actor-Kind: human and move a ticket to
// Done (200). Only the person moves tickets to Done, so a token always acts as an agent.
describe('regression: an API token always acts as an agent', () => {
  const api = useTestServer('sqlite');
  let owner: Record<string, string> = {};
  let agent: Record<string, string> = {};

  const send = async <T>(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: unknown,
  ) => {
    const res = await api.app.request(path, {
      method,
      headers: { ...JSON_HEADERS, ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: (await res.json()) as T };
  };

  beforeEach(async () => {
    await addOwner(api.db);
    owner = { cookie: await signIn(api.app) };
    const { body } = await send<CreatedApiToken>('POST', '/api/tokens', owner, { name: 'Claude' });
    agent = { authorization: `Bearer ${body.secret}` };
  });

  it('cannot move a ticket to Done, whatever actor it names', async () => {
    const { body: project } = await send<ProjectDetail>('POST', '/api/projects', owner, {
      name: 'Mobile',
      key: 'MOB',
    });
    await send('POST', '/api/projects/MOB/tickets', owner, { title: 'Crash' });
    const done = project.statuses.find((status) => status.category === 'done')!;
    const asHuman = { ...agent, 'x-actor-kind': 'human', 'x-actor-name': 'User' };

    const moved = await send<ErrorBody>('PATCH', '/api/tickets/MOB-1', asHuman, {
      statusId: done.id,
    });
    expect(moved.status).toBe(403);
    expect(moved.body.error.code).toBe('forbidden');

    const comment = await send<TicketDetail>('POST', '/api/tickets/MOB-1/comments', asHuman, {
      text: 'Looks done to me',
    });
    expect(comment.status).toBe(201);
    const ticket = await send<TicketDetail>('GET', '/api/tickets/MOB-1', owner);
    const last = ticket.body.activity.at(-1)!;
    expect(last.actor).toEqual({ kind: 'agent', name: 'User' });
  });

  it('names a token request Agent when it gives no name', async () => {
    await send('POST', '/api/projects', owner, { name: 'Mobile', key: 'MOB' });
    await send('POST', '/api/projects/MOB/tickets', agent, { title: 'From an agent' });
    const ticket = await send<TicketDetail>('GET', '/api/tickets/MOB-1', owner);
    expect(ticket.body.activity[0]!.actor).toEqual({ kind: 'agent', name: 'Agent' });
  });

  it('lets the owner, signed in, move a ticket to Done', async () => {
    const { body: project } = await send<ProjectDetail>('POST', '/api/projects', owner, {
      name: 'Mobile',
      key: 'MOB',
    });
    await send('POST', '/api/projects/MOB/tickets', owner, { title: 'Crash' });
    const done = project.statuses.find((status) => status.category === 'done')!;
    const moved = await send('PATCH', '/api/tickets/MOB-1', owner, { statusId: done.id });
    expect(moved.status).toBe(200);
  });
});
