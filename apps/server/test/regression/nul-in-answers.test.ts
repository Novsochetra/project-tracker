import { describe, expect, it } from 'vitest';
import { setOwner } from '../../src/auth/owner';
import { CHEAP_SCRYPT, loginRequest } from '../helpers/auth';
import { agent } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// A NUL was dropped only on its way into the database (nul-in-text): the answer to the write still
// had it, and an edit that only added one counted as a change, with a "changed" entry in the
// activity and a live update, though the stored text stayed the same.
describe.each(DIALECTS)('a NUL character sent to the API (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('is not in the answer to the write', async () => {
    const person = api.client();
    const project = await person.createProject({ name: 'Mobile\u0000 app', key: 'MA' });
    expect(project.project.name).toBe('Mobile app');
    const ticket = await person.createTicket('MA', {
      title: 'Cr\u0000ash',
      description: 'On\u0000 launch',
      assignee: 'Ma\u0000ya',
    });
    expect(ticket).toMatchObject({ title: 'Crash', description: 'On launch', assignee: 'Maya' });
    const edited = await person.updateTicket('MA-1', { title: 'Crash on\u0000 start' });
    expect(edited.title).toBe('Crash on start');
    const comment = await api.client(agent('Claude\u0000 Worker')).addComment('MA-1', {
      text: 'Lo\u0000gs',
    });
    expect(comment).toMatchObject({
      text: 'Logs',
      actor: { kind: 'agent', name: 'Claude Worker' },
    });
    const status = await person.createStatus('MA', { name: 'Blo\u0000cked', category: 'todo' });
    expect(status.name).toBe('Blocked');
  });

  it('is no change when it is all an edit adds', async () => {
    const person = api.client();
    await person.createProject({ name: 'Mobile app', key: 'MA' });
    const created = await person.createTicket('MA', { title: 'Crash', description: 'On launch' });
    const before = await person.getTicket('MA-1');
    api.events.length = 0;

    const edited = await person.updateTicket('MA-1', {
      title: 'Cr\u0000ash',
      description: 'On launch\u0000',
    });

    expect(edited).toMatchObject({ title: 'Crash', updatedAt: created.updatedAt });
    expect(api.events).toEqual([]);
    expect((await person.getTicket('MA-1')).activity).toEqual(before.activity);
  });

  // The web app sends the text a save was typed over; with a NUL in it, the stored text never
  // matched, so every later save of the field was refused as stale.
  it('is left out of the text an edit was typed over', async () => {
    const person = api.client();
    await person.createProject({ name: 'Mobile app', key: 'MA' });
    await person.createTicket('MA', { title: 'Cr\u0000ash' });

    const edited = await person.updateTicket('MA-1', { title: 'Crash!' }, { title: 'Cr\u0000ash' });

    expect(edited.title).toBe('Crash!');
  });

  // A password is compared with the one owner:set hashed, so a sign-in keeps its NULs.
  it('stays in the password a sign-in sends', async () => {
    const owner = { email: 'owner@example.com', password: 'correct\u0000 horse battery' };
    await setOwner(api.db, owner, 1_000, CHEAP_SCRYPT);

    expect((await api.app.request('/api/session', loginRequest(owner))).status).toBe(200);
    const without = { ...owner, password: 'correct horse battery' };
    expect((await api.app.request('/api/session', loginRequest(without))).status).toBe(401);
  });
});
