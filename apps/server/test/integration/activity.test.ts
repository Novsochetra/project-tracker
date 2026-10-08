import type { Activity, ErrorBody, Ticket } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, imageUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('comments and activity (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let ticket: Ticket;

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app' });
    ticket = await api.client().createTicket('MA', { title: 'Crash' });
    api.events.length = 0;
  });

  const upload = async (ticketKey?: string) => (await api.upload(imageUpload({ ticketKey }))).body;

  it('adds a trimmed comment from the request actor and bumps the ticket', async () => {
    const res = await api.post<Activity>(
      `/api/tickets/${ticket.key}/comments`,
      { text: '  Looks like a race.  ' },
      { actor: agent('Claude Worker') },
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      type: 'comment',
      text: 'Looks like a race.',
      ticketId: ticket.id,
      actor: { kind: 'agent', name: 'Claude Worker' },
      review: null,
      attachments: [],
      editedAt: null,
    });
    const detail = await api.client().getTicket(ticket.key);
    expect(detail.activity.at(-1)).toEqual(res.body);
    expect(detail.ticket.updatedAt).toBe(res.body.createdAt);
    expect(api.events).toEqual([
      { type: 'changed', projectId: ticket.projectId, ticketId: ticket.id },
    ]);
  });

  it('reads the actor from the headers', async () => {
    const say = (headers: Record<string, string>) =>
      api.post<Activity>(`/api/tickets/${ticket.key}/comments`, { text: 'hi' }, { headers });
    expect((await say({})).body.actor).toEqual({ kind: 'human', name: '' });
    expect((await say({ 'x-actor-kind': 'agent' })).body.actor).toEqual({
      kind: 'agent',
      name: 'Agent',
    });
    expect(
      (await say({ 'x-actor-kind': 'agent', 'x-actor-name': encodeURIComponent('  Résumé bot  ') }))
        .body.actor,
    ).toEqual({ kind: 'agent', name: 'Résumé bot' });
    expect((await say({ 'x-actor-kind': 'human', 'x-actor-name': 'Dara' })).body.actor).toEqual({
      kind: 'human',
      name: 'Dara',
    });
    expect(
      (await say({ 'x-actor-kind': 'agent', 'x-actor-name': 'x'.repeat(80) })).body.actor.name,
    ).toHaveLength(60);
    expect(
      (await say({ 'x-actor-kind': 'agent', 'x-actor-name': '%E0%A4%A' })).body.actor.name,
    ).toBe('%E0%A4%A');
  });

  it('needs text or a file', async () => {
    const res = await api.post<ErrorBody>(`/api/tickets/${ticket.key}/comments`, { text: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'invalid_input',
      message: 'Write a comment or add a file.',
    });
    expect((await api.post('/api/tickets/MA-9/comments', { text: 'x' })).status).toBe(404);
  });

  it('links pending images to the comment and keeps them out of the ticket images', async () => {
    const image = await upload();
    const comment = await api.client().addComment(ticket.key, { attachmentIds: [image.id] });
    expect(comment.text).toBe('');
    expect(comment.attachments).toMatchObject([
      { id: image.id, ticketId: ticket.id, activityId: comment.id },
    ]);
    const detail = await api.client().getTicket(ticket.key);
    expect(detail.attachments).toEqual([]);
    expect(detail.activity.at(-1)!.attachments.map((a) => a.id)).toEqual([image.id]);
  });

  it('can move a ticket image into a comment but not an image of another ticket', async () => {
    const own = await upload(ticket.key);
    const comment = await api
      .client()
      .addComment(ticket.key, { text: 'see', attachmentIds: [own.id] });
    expect(comment.attachments.map((a) => a.id)).toEqual([own.id]);

    const other = await api.client().createTicket('MA', { title: 'Other' });
    const foreign = await upload(other.key);
    const res = await api.post<ErrorBody>(`/api/tickets/${ticket.key}/comments`, {
      text: 'steal',
      attachmentIds: [foreign.id],
    });
    expect(res.status).toBe(400);
    const comments = (await api.client().getTicket(ticket.key)).activity.filter(
      (a) => a.type === 'comment',
    );
    expect(comments).toHaveLength(1);
  });

  it('edits only comments and marks them edited', async () => {
    const comment = await api.client().addComment(ticket.key, { text: 'first' });
    const res = await api.patch<Activity>(`/api/activity/${comment.id}`, { text: '  second  ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: comment.id,
      text: 'second',
      createdAt: comment.createdAt,
    });
    expect(res.body.editedAt).toBeGreaterThan(comment.createdAt);

    const event = (await api.client().getTicket(ticket.key)).activity[0]!;
    const notComment = await api.patch<ErrorBody>(`/api/activity/${event.id}`, { text: 'x' });
    expect(notComment.status).toBe(409);
    expect((await api.patch(`/api/activity/${comment.id}`, { text: ' ' })).status).toBe(400);
    expect((await api.patch('/api/activity/missing', { text: 'x' })).status).toBe(404);
  });

  it('deletes comments, reports and reviews but never events', async () => {
    const client = api.client();
    const image = await upload();
    const comment = await client.addComment(ticket.key, { text: 'x', attachmentIds: [image.id] });
    await client.applyReport({ text: 'TICKET: MA-1\nSTATUS: in progress\nSUMMARY: wip' });
    await client.submitForReview(ticket.key, { summary: 'Done' });
    await client.reviewTicket(ticket.key, { verdict: 'approved', rating: 4, summary: 'Good' });
    const activity = (await client.getTicket(ticket.key)).activity;
    const removable = activity.filter((item) => item.type !== 'event');
    expect(removable.map((item) => item.type)).toEqual(['comment', 'report', 'report', 'review']);
    expect(api.storage.files.size).toBe(1);

    for (const item of removable) {
      expect((await api.delete(`/api/activity/${item.id}`)).status).toBe(204);
    }
    expect(api.storage.files.size).toBe(0);
    expect(
      await api.db.selectFrom('attachments').select('id').where('id', '=', image.id).execute(),
    ).toEqual([]);

    const event = activity.find((item) => item.type === 'event')!;
    const res = await api.delete<ErrorBody>(`/api/activity/${event.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
    expect((await api.delete(`/api/activity/${comment.id}`)).status).toBe(404);
  });
});
