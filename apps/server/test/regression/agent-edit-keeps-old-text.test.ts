import { TICKET_DESCRIPTION_MAX, type Ticket, type TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const STEPS = 'Steps:\n1. Open the app\n2. Turn the phone\n\nIt crashes.';

// PT-276: an agent's PATCH could replace the person's title and clear their description with no
// activity entry, so the old text was lost for good. Now the event keeps it, and events can't be
// edited or deleted.
describe.each(DIALECTS)('regression: an agent edit keeps the old text (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;

  const detail = async () => (await person<TicketDetail>('GET', '/api/tickets/MOB-1')).body;

  const events = async () =>
    (await detail()).activity
      .filter((entry) => entry.type === 'event')
      .map((entry) => `${entry.actor.kind}: ${entry.text}`);

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now(), 'owner');
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', {
      title: 'Crash on launch',
      description: STEPS,
    });
  });

  it('records the title and the description an agent replaced or cleared', async () => {
    const edited = await helper<Ticket>('PATCH', '/api/tickets/MOB-1', {
      title: 'Crash',
      description: '',
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ title: 'Crash', description: '' });

    expect(await events()).toEqual([
      'human: created the ticket',
      'agent: changed the title from “Crash on launch”',
      `agent: removed the description\n${STEPS}`,
    ]);
  });

  it('keeps a changed description, and says when there was none before', async () => {
    await helper('PATCH', '/api/tickets/MOB-1', { description: 'Rotating crashes it.' });
    await person('PATCH', '/api/tickets/MOB-1', { description: '' });
    await helper('PATCH', '/api/tickets/MOB-1', { description: 'It crashes.' });

    expect(await events()).toEqual([
      'human: created the ticket',
      `agent: changed the description\n${STEPS}`,
      'agent: added a description',
    ]);
  });

  it('keeps a description of the longest size whole', async () => {
    const longest = 'a'.repeat(TICKET_DESCRIPTION_MAX - 1) + '\n';
    await person('PATCH', '/api/tickets/MOB-1', { description: longest });
    await helper('PATCH', '/api/tickets/MOB-1', { description: 'Short' });

    const event = (await detail()).activity.at(-1);
    expect(event).toMatchObject({ type: 'event', actor: { kind: 'agent' } });
    expect(event?.text).toBe(`changed the description\n${longest}`);
  });

  it('logs nothing for a person, or for an agent that changes nothing', async () => {
    await person('PATCH', '/api/tickets/MOB-1', { title: 'Crash', description: 'New' });
    await helper('PATCH', '/api/tickets/MOB-1', { title: 'Crash', description: 'New' });

    expect(await events()).toEqual(['human: created the ticket']);
    expect(await detail()).toMatchObject({ ticket: { title: 'Crash', description: 'New' } });
  });
});

describe.each(DIALECTS)('regression: an agent edit without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('keeps the old title for an agent that says so', async () => {
    const person = api.client();
    await person.createProject({ name: 'Mobile', key: 'MOB' });
    await person.createTicket('MOB', { title: 'Crash on launch' });

    await api.client(agent()).updateTicket('MOB-1', { title: 'Crash' });

    expect((await person.getTicket('MOB-1')).activity.at(-1)).toMatchObject({
      type: 'event',
      actor: { kind: 'agent', name: 'Claude' },
      text: 'changed the title from “Crash on launch”',
    });
  });
});
