import { describe, expect, it, vi } from 'vitest';
import { ToolError } from '../../src/errors';
import { getTicket } from '../../src/tools/getTicket';
import { listProjects } from '../../src/tools/listProjects';
import { listStatuses } from '../../src/tools/listStatuses';
import { listTickets } from '../../src/tools/listTickets';
import { fakeClient, returns } from '../fakeClient';
import { activity, attachment, detail, projectSummary, statuses, ticket } from '../fixtures';
import { run } from './run';

const projectDetail = () => {
  const {
    totalCount: _t,
    openCount: _o,
    doneCount: _d,
    lastActivityAt: _l,
    ...project
  } = projectSummary();
  return { project, statuses: statuses().reverse() };
};

describe('list_projects', () => {
  it('lists projects as lines and returns the raw data', async () => {
    const projects = [projectSummary()];
    const client = fakeClient({ listProjects: vi.fn(returns(projects)) });
    const reply = await run(listProjects, client, {});
    expect(reply.text).toBe('MOB · Mobile app · 3 open, 7 total');
    expect(reply.data).toBe(projects);
  });
});

describe('list_statuses', () => {
  it("lists the project's statuses in board order", async () => {
    const getProject = vi.fn(returns(projectDetail()));
    const reply = await run(listStatuses, fakeClient({ getProject }), { project: ' mob ' });
    expect(getProject).toHaveBeenCalledWith('MOB');
    expect(reply.text.split('\n')[0]).toBe('To do · todo');
    expect(reply.data).toEqual(statuses());
  });
});

describe('list_tickets', () => {
  it('passes the filters and prints one line per ticket', async () => {
    const listTicketsApi = vi.fn(returns([ticket({ statusId: 's2', assignee: 'Sam' })]));
    const client = fakeClient({
      getProject: returns(projectDetail()),
      listTickets: listTicketsApi,
    });
    const reply = await run(listTickets, client, {
      project: 'MOB',
      status: 'in PROGRESS',
      category: 'in_progress',
      query: ' crash ',
    });
    expect(listTicketsApi).toHaveBeenCalledWith('MOB', {
      status: 'In progress',
      category: 'in_progress',
      q: 'crash',
    });
    expect(reply.text).toBe(
      'MOB-3 · In progress · High · Crash when rotating the profile screen · @Sam',
    );
  });

  it('lists everything without filters', async () => {
    const listTicketsApi = vi.fn(returns([]));
    const client = fakeClient({
      getProject: returns(projectDetail()),
      listTickets: listTicketsApi,
    });
    const reply = await run(listTickets, client, { project: 'MOB' });
    expect(listTicketsApi).toHaveBeenCalledWith('MOB', {
      status: undefined,
      category: undefined,
      q: undefined,
    });
    expect(reply.text).toBe('No tickets found.');
  });

  it('rejects an unknown status name with the valid names', async () => {
    const listTicketsApi = vi.fn();
    const client = fakeClient({
      getProject: returns(projectDetail()),
      listTickets: listTicketsApi,
    });
    const result = run(listTickets, client, { project: 'MOB', status: 'Doing' });
    await expect(result).rejects.toThrow(ToolError);
    await expect(result).rejects.toThrow(
      'There is no status named "Doing". Valid statuses: "To do", "In progress", "Need review", "Reviewed", "Done".',
    );
    expect(listTicketsApi).not.toHaveBeenCalled();
  });

  it('only accepts known categories', () => {
    expect(listTickets.input.safeParse({ project: 'MOB', category: 'doing' }).success).toBe(false);
  });
});

describe('get_ticket', () => {
  it('returns the full view, the detail and the images to show', async () => {
    const ticketDetail = detail({ attachments: [attachment()] });
    const getTicketApi = vi.fn(returns(ticketDetail));
    const reply = await run(getTicket, fakeClient({ getTicket: getTicketApi }), {
      ticket: 'mob-3',
    });
    expect(getTicketApi).toHaveBeenCalledWith('MOB-3');
    expect(reply.text.split('\n')[0]).toBe('# MOB-3: Crash when rotating the profile screen');
    expect(reply.data).toBe(ticketDetail);
    expect(reply.images).toEqual([attachment()]);
  });

  it('rejects a malformed ticket key', () => {
    const result = getTicket.input.safeParse({ ticket: 'MOB3' });
    expect(result.error?.issues[0]?.message).toBe('Use a ticket key like MOB-3.');
  });

  const FILES = 'http://localhost:4100/api/attachments';
  const attachmentFileUrl = (id: string) => `${FILES}/${id}/file`;
  const file = (id: string, fileName: string, mimeType: string, activityId: string | null = null) =>
    attachment({ id, fileName, mimeType, activityId, size: 2048, width: null, height: null });

  it('shows text files inline and links videos and PDFs without downloading them', async () => {
    const fetchAttachmentText = vi.fn(returns('boom at line 3\n'));
    const fetchAttachment = vi.fn();
    const files = [
      file('log', 'crash.log', 'text/plain'),
      file('vid', 'repro.mov', 'video/quicktime'),
      file('pdf', 'spec.pdf', 'application/pdf'),
    ];
    const client = fakeClient({
      getTicket: returns(detail({ attachments: files })),
      fetchAttachmentText,
      fetchAttachment,
      attachmentFileUrl,
    });
    const reply = await run(getTicket, client, { ticket: 'MOB-3' });
    expect(fetchAttachmentText).toHaveBeenCalledWith('log');
    expect(fetchAttachment).not.toHaveBeenCalled();
    expect(reply.text).toContain(
      [
        '## Attachments',
        '- crash.log · text/plain · 2 KB',
        `- repro.mov · video/quicktime · 2 KB · ${FILES}/vid/file`,
        `- spec.pdf · application/pdf · 2 KB · ${FILES}/pdf/file`,
        '',
        'Contents of crash.log:',
        '```',
        'boom at line 3',
        '```',
        '',
        '## Activity (oldest first)',
      ].join('\n'),
    );
    expect(reply.text).not.toContain('access token');
    expect(reply.images).toEqual([]);
  });

  it('reads the text files of comments too', async () => {
    const log = file('log', 'server.log', 'text/plain', 'act2');
    const comment = activity({ id: 'act2', type: 'comment', text: 'Logs.', attachments: [log] });
    const client = fakeClient({
      getTicket: returns(detail({ attachments: [log], activity: [comment] })),
      fetchAttachmentText: returns('ERROR db down'),
    });
    const reply = await run(getTicket, client, { ticket: 'MOB-3' });
    expect(reply.text).toContain(
      'Logs.\nAttachments:\n- server.log · text/plain · 2 KB\n\n' +
        'Contents of server.log:\n```\nERROR db down\n```',
    );
  });

  it('says that download links need the access token when the agent uses one', async () => {
    const client = fakeClient({
      getTicket: returns(detail({ attachments: [file('pdf', 'spec.pdf', 'application/pdf')] })),
      attachmentFileUrl,
      usesToken: true,
    });
    const reply = await run(getTicket, client, { ticket: 'MOB-3' });
    expect(reply.text.split('\n').at(-1)).toBe(
      'Download links need the access token: send the header "Authorization: Bearer <TRACKER_TOKEN>".',
    );
  });

  it('says nothing about the token when no link is shown', async () => {
    const client = fakeClient({
      getTicket: returns(detail({ attachments: [attachment()] })),
      usesToken: true,
    });
    const reply = await run(getTicket, client, { ticket: 'MOB-3' });
    expect(reply.text).not.toContain('access token');
  });
});
