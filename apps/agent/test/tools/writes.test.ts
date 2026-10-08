import { describe, expect, it, vi } from 'vitest';
import { addComment } from '../../src/tools/addComment';
import { createTicket } from '../../src/tools/createTicket';
import { moveTicket } from '../../src/tools/moveTicket';
import { updateTicket } from '../../src/tools/updateTicket';
import { fakeClient, returns } from '../fakeClient';
import { activity, detail, projectSummary, statuses, statusAt, ticket } from '../fixtures';
import { run } from './run';

const projectDetail = () => {
  const {
    totalCount: _t,
    openCount: _o,
    doneCount: _d,
    lastActivityAt: _l,
    ...project
  } = projectSummary();
  return { project, statuses: statuses() };
};

describe('create_ticket', () => {
  it('resolves the status name and prints the new ticket', async () => {
    const created = ticket({
      key: 'MOB-8',
      statusId: 's2',
      priority: 'low',
      title: 'Add dark mode',
    });
    const createTicketApi = vi.fn(returns(created));
    const client = fakeClient({
      getProject: returns(projectDetail()),
      createTicket: createTicketApi,
    });
    const reply = await run(createTicket, client, {
      project: 'mob',
      title: ' Add dark mode ',
      description: 'Follow the system setting.',
      priority: 'low',
      status: 'IN PROGRESS',
    });
    expect(createTicketApi).toHaveBeenCalledWith('MOB', {
      title: 'Add dark mode',
      description: 'Follow the system setting.',
      priority: 'low',
      statusId: 's2',
    });
    expect(reply.text).toBe('Created MOB-8 · In progress · Low · Add dark mode');
    expect(reply.data).toBe(created);
  });

  it('leaves status and priority to the server when not given', async () => {
    const createTicketApi = vi.fn(returns(ticket({ key: 'MOB-8', priority: 'medium' })));
    const client = fakeClient({
      getProject: returns(projectDetail()),
      createTicket: createTicketApi,
    });
    const reply = await run(createTicket, client, { project: 'MOB', title: 'Crash' });
    expect(createTicketApi).toHaveBeenCalledWith('MOB', {
      title: 'Crash',
      description: undefined,
      priority: undefined,
      statusId: undefined,
    });
    expect(reply.text).toBe(
      'Created MOB-8 · To do · Medium · Crash when rotating the profile screen',
    );
  });

  it('rejects an unknown status before creating anything', async () => {
    const createTicketApi = vi.fn();
    const client = fakeClient({
      getProject: returns(projectDetail()),
      createTicket: createTicketApi,
    });
    await expect(
      run(createTicket, client, { project: 'MOB', title: 'Crash', status: 'Backlog' }),
    ).rejects.toThrow('There is no status named "Backlog".');
    expect(createTicketApi).not.toHaveBeenCalled();
  });

  it('requires a title', () => {
    const result = createTicket.input.safeParse({ project: 'MOB', title: '   ' });
    expect(result.error?.issues[0]?.message).toBe('The title cannot be empty.');
  });
});

describe('update_ticket', () => {
  it('sends only the given fields and names them', async () => {
    const updateTicketApi = vi.fn(returns(ticket({ priority: 'low', assignee: '' })));
    const reply = await run(updateTicket, fakeClient({ updateTicket: updateTicketApi }), {
      ticket: 'mob-3',
      priority: 'low',
      assignee: '',
      due: '2026-10-09',
    });
    expect(updateTicketApi).toHaveBeenCalledWith('MOB-3', {
      priority: 'low',
      assignee: '',
      due: '2026-10-09',
    });
    expect(reply.text).toBe('Updated MOB-3: priority, assignee, due.');
  });

  it('refuses an update without fields', async () => {
    const updateTicketApi = vi.fn();
    await expect(
      run(updateTicket, fakeClient({ updateTicket: updateTicketApi }), { ticket: 'MOB-3' }),
    ).rejects.toThrow('Nothing to update.');
    expect(updateTicketApi).not.toHaveBeenCalled();
  });

  it('accepts an empty due date to clear it and rejects other formats', () => {
    expect(updateTicket.input.safeParse({ ticket: 'MOB-3', due: '' }).success).toBe(true);
    const result = updateTicket.input.safeParse({ ticket: 'MOB-3', due: '10/09/2026' });
    expect(result.error?.issues[0]?.message).toBe(
      'Use a due date like 2026-10-09, or an empty string.',
    );
  });
});

describe('move_ticket', () => {
  it('resolves the status name case-insensitively and moves the ticket', async () => {
    const updateTicketApi = vi.fn(returns(ticket({ statusId: 's3' })));
    const client = fakeClient({ getTicket: returns(detail()), updateTicket: updateTicketApi });
    const reply = await run(moveTicket, client, { ticket: 'MOB-3', status: '  need REVIEW ' });
    expect(updateTicketApi).toHaveBeenCalledWith('MOB-3', { statusId: 's3' });
    expect(reply.text).toBe('Moved MOB-3 to Need review.');
  });

  it('lists the valid names when the status does not exist', async () => {
    const updateTicketApi = vi.fn();
    const client = fakeClient({ getTicket: returns(detail()), updateTicket: updateTicketApi });
    await expect(run(moveTicket, client, { ticket: 'MOB-3', status: 'Doing' })).rejects.toThrow(
      'There is no status named "Doing". Valid statuses: "To do", "In progress", "Need review", "Reviewed", "Done".',
    );
    expect(updateTicketApi).not.toHaveBeenCalled();
  });

  it('does nothing when the ticket is already in that status', async () => {
    const updateTicketApi = vi.fn();
    const client = fakeClient({
      getTicket: returns(detail({ ticket: ticket({ statusId: 's2' }), status: statusAt(1) })),
      updateTicket: updateTicketApi,
    });
    const reply = await run(moveTicket, client, { ticket: 'MOB-3', status: 'In progress' });
    expect(reply.text).toBe('MOB-3 is already in In progress.');
    expect(updateTicketApi).not.toHaveBeenCalled();
  });

  it('never moves a ticket to a done status', async () => {
    const updateTicketApi = vi.fn();
    const client = fakeClient({ getTicket: returns(detail()), updateTicket: updateTicketApi });
    await expect(run(moveTicket, client, { ticket: 'MOB-3', status: 'done' })).rejects.toThrow(
      'Only a person can move a ticket to Done. When the work is finished, use submit_for_review.',
    );
    expect(updateTicketApi).not.toHaveBeenCalled();
  });

  it('points a reviewer at review_ticket when the ticket waits for review', async () => {
    const updateTicketApi = vi.fn();
    const client = fakeClient({
      getTicket: returns(detail({ ticket: ticket({ statusId: 's3' }), status: statusAt(2) })),
      updateTicket: updateTicketApi,
    });
    await expect(run(moveTicket, client, { ticket: 'MOB-3', status: 'Done' })).rejects.toThrow(
      'Only a person can move a ticket to Done. To finish a review, use review_ticket.',
    );
    expect(updateTicketApi).not.toHaveBeenCalled();
  });

  it('says a ticket in a done status is already there', async () => {
    const updateTicketApi = vi.fn();
    const client = fakeClient({
      getTicket: returns(detail({ ticket: ticket({ statusId: 's5' }), status: statusAt(4) })),
      updateTicket: updateTicketApi,
    });
    await expect(run(moveTicket, client, { ticket: 'MOB-3', status: 'Done' })).rejects.toThrow(
      'MOB-3 is already in Done. Only a person moves tickets out of it.',
    );
    expect(updateTicketApi).not.toHaveBeenCalled();
  });

  it('says a reviewed ticket is waiting for a person', async () => {
    const updateTicketApi = vi.fn();
    const client = fakeClient({
      getTicket: returns(detail({ ticket: ticket({ statusId: 's4' }), status: statusAt(3) })),
      updateTicket: updateTicketApi,
    });
    await expect(run(moveTicket, client, { ticket: 'MOB-3', status: 'Done' })).rejects.toThrow(
      'MOB-3 is in Reviewed, waiting for a person to move it to Done.',
    );
    expect(updateTicketApi).not.toHaveBeenCalled();
  });
});

describe('add_comment', () => {
  it('adds the trimmed comment', async () => {
    const comment = activity({ type: 'comment', text: 'Blocked on the API.' });
    const addCommentApi = vi.fn(returns(comment));
    const reply = await run(addComment, fakeClient({ addComment: addCommentApi }), {
      ticket: 'mob-3',
      text: ' Blocked on the API. ',
    });
    expect(addCommentApi).toHaveBeenCalledWith('MOB-3', { text: 'Blocked on the API.' });
    expect(reply).toEqual({ text: 'Added a comment to MOB-3.', data: comment });
  });

  it('requires text', () => {
    const result = addComment.input.safeParse({ ticket: 'MOB-3', text: ' ' });
    expect(result.error?.issues[0]?.message).toBe('Write the comment text.');
  });
});
