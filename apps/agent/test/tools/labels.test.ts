import type { Label } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { formatTicket } from '../../src/format/ticket';
import { createTicket } from '../../src/tools/createTicket';
import { listTickets } from '../../src/tools/listTickets';
import { updateTicket } from '../../src/tools/updateTicket';
import { fakeClient, returns } from '../fakeClient';
import { detail, projectSummary, statuses, ticket } from '../fixtures';
import { run } from './run';

const label = (id: string, name: string, position: number, instructions = ''): Label => ({
  id,
  projectId: 'p1',
  name,
  color: '#B42318',
  template: '',
  instructions,
  position,
  createdAt: 1,
});

const bug = label('l-bug', 'Bug', 0, 'Write a failing test first.');
const ui = label('l-ui', 'UI', 1);

const project = (labels?: Label[]) => ({
  project: projectSummary(),
  statuses: statuses(),
  ...(labels ? { labels } : {}),
});

describe('labels in the tools', () => {
  it('create_ticket takes label names, any case, and prints them', async () => {
    const created = ticket({ key: 'MOB-8', labelIds: ['l-bug', 'l-ui'] });
    const createTicketApi = vi.fn(returns(created));
    const client = fakeClient({
      getProject: returns(project([bug, ui])),
      createTicket: createTicketApi,
    });
    const reply = await run(createTicket, client, {
      project: 'MOB',
      title: 'Crash',
      labels: ['ui', ' BUG '],
    });
    expect(createTicketApi).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ labelIds: ['l-ui', 'l-bug'] }),
    );
    expect(reply.text).toBe(
      'Created MOB-8 · To do · High · Crash when rotating the profile screen · labels: Bug, UI',
    );
  });

  it('refuses an unknown label, naming the project’s labels', async () => {
    const createTicketApi = vi.fn();
    const client = fakeClient({
      getProject: returns(project([bug, ui])),
      createTicket: createTicketApi,
    });
    await expect(
      run(createTicket, client, { project: 'MOB', title: 'Crash', labels: ['Bugs'] }),
    ).rejects.toThrow('There is no label named "Bugs". Valid labels: "Bug", "UI".');
    const older = fakeClient({ getProject: returns(project()), createTicket: createTicketApi });
    await expect(
      run(createTicket, older, { project: 'MOB', title: 'Crash', labels: ['Bug'] }),
    ).rejects.toThrow('This project has no labels yet');
    expect(createTicketApi).not.toHaveBeenCalled();
  });

  it('update_ticket sets the whole set of labels of the ticket’s project', async () => {
    const getProject = vi.fn(returns(project([bug, ui])));
    const updateTicketApi = vi.fn(returns(ticket({ labelIds: [] })));
    const client = fakeClient({ getProject, updateTicket: updateTicketApi });
    const reply = await run(updateTicket, client, { ticket: 'mob-3', labels: ['Bug'] });
    expect(getProject).toHaveBeenCalledWith('MOB');
    expect(updateTicketApi).toHaveBeenCalledWith('MOB-3', { labelIds: ['l-bug'] });
    expect(reply.text).toBe('Updated MOB-3: labels.');
    await run(updateTicket, client, { ticket: 'MOB-3', labels: [] });
    expect(updateTicketApi).toHaveBeenLastCalledWith('MOB-3', { labelIds: [] });
  });

  it('list_tickets filters by a label of the project', async () => {
    const listTicketsApi = vi.fn(returns([ticket({ labelIds: ['l-bug'] })]));
    const client = fakeClient({
      getProject: returns(project([bug, ui])),
      listTickets: listTicketsApi,
    });
    const reply = await run(listTickets, client, { project: 'MOB', label: 'bug' });
    expect(listTicketsApi).toHaveBeenCalledWith('MOB', expect.objectContaining({ label: 'Bug' }));
    expect(reply.text).toContain('· labels: Bug');
    await expect(run(listTickets, client, { project: 'MOB', label: 'Idea' })).rejects.toThrow(
      'There is no label named "Idea".',
    );
  });

  it('get_ticket names the labels and gives their instructions after the project’s', () => {
    const shown = detail({ ticket: ticket({ labelIds: ['l-bug'] }), labels: [bug, ui] });
    const text = formatTicket({
      ...shown,
      project: { ...shown.project, instructions: 'Be brief.' },
    });
    expect(text).toContain('Labels: Bug');
    expect(text).toContain(
      '## Project instructions\nBe brief.\n\n## Instructions for "Bug" tickets\nWrite a failing test first.',
    );
    expect(text.indexOf('Instructions for "Bug"')).toBeLessThan(text.indexOf('## Description'));
  });
});
