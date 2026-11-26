import {
  FILE_NAME_HEADER,
  type Activity,
  type Attachment,
  type ErrorBody,
  type TicketDetail,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, fileUpload } from '../helpers/fixtures';
import { addUser, caller, type Auth, type Caller } from '../helpers/callers';
import { DIALECTS, useTestServer } from '../helpers/server';

const REFUSED: ErrorBody = {
  error: { code: 'forbidden', message: 'Only a person deletes a file.' },
};

interface Files {
  ticketFile: string;
  commentFile: string;
  pendingFile: string;
}

// PT-276: an API token could delete any file on the person's tickets and comments for good (204,
// the stored file removed), though no MCP tool or CLI command needs to.
describe.each(DIALECTS)('regression: an agent deletes a file (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let tokenAgent: Caller;
  let files: Files;

  const upload = async (auth: Auth, ticketKey?: string): Promise<string> => {
    const query = ticketKey ? `?ticketKey=${ticketKey}` : '';
    const response = await api.app.request(`/api/attachments${query}`, {
      method: 'POST',
      headers: {
        cookie: auth.cookie ?? '',
        'content-type': 'text/plain',
        [FILE_NAME_HEADER]: 'a.txt',
      },
      body: 'notes',
    });

    return ((await response.json()) as Attachment).id;
  };

  const ticketFiles = async () => {
    const detail = (await person<TicketDetail>('GET', '/api/tickets/MOB-1')).body;
    const onComments = detail.activity.flatMap((entry) => entry.attachments);

    return [...detail.attachments, ...onComments].map((file) => file.id);
  };

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now(), 'owner');
    person = caller(() => api.app, owner.person);
    tokenAgent = caller(() => api.app, owner.agent);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    const ticketFile = await upload(owner.person, 'MOB-1');
    const commentFile = await upload(owner.person);
    await person<Activity>('POST', '/api/tickets/MOB-1/comments', {
      text: 'The log',
      attachmentIds: [commentFile],
    });
    files = { ticketFile, commentFile, pendingFile: await upload(owner.person) };
  });

  it('answers 403 to an agent token before the id is read, and keeps every file', async () => {
    const before = await ticketFiles();
    expect(before).toEqual([files.ticketFile, files.commentFile]);

    for (const id of [files.ticketFile, files.commentFile, files.pendingFile, 'missing']) {
      expect(await tokenAgent('DELETE', `/api/attachments/${id}`), id).toEqual({
        status: 403,
        body: REFUSED,
      });
    }

    expect(await ticketFiles()).toEqual(before);
    expect(api.storage.files.size).toBe(3);
  });

  it('lets the person delete each file', async () => {
    for (const id of [files.ticketFile, files.commentFile, files.pendingFile]) {
      expect((await person('DELETE', `/api/attachments/${id}`)).status, id).toBe(204);
    }

    expect(await ticketFiles()).toEqual([]);
    expect(api.storage.files.size).toBe(0);
  });
});

describe.each(DIALECTS)('regression: an agent deletes a file without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('refuses an agent that says so, and lets the person through', async () => {
    const person = api.client();
    await person.createProject({ name: 'Mobile', key: 'MOB' });
    await person.createTicket('MOB', { title: 'Crash' });
    const file = (await api.upload<Attachment>(fileUpload({ ticketKey: 'MOB-1' }))).body;

    await expect(api.client(agent()).deleteAttachment(file.id)).rejects.toMatchObject({
      status: 403,
      message: 'Only a person deletes a file.',
    });
    expect((await person.getTicket('MOB-1')).attachments).toHaveLength(1);

    await expect(person.deleteAttachment(file.id)).resolves.toBeUndefined();
    expect((await person.getTicket('MOB-1')).attachments).toEqual([]);
  });
});
