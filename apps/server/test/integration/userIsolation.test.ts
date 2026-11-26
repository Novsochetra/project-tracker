import {
  FILE_NAME_HEADER,
  type Activity,
  type Attachment,
  type Label,
  type ProjectDetail,
  type ProjectSummary,
  type TicketsAcrossProjects,
  type TicketSearchResults,
} from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, type Auth, type Caller } from '../helpers/callers';
import { DIALECTS, useTestServer } from '../helpers/server';

type Reader = ReadableStreamDefaultReader<Uint8Array>;

async function readUntil(reader: Reader, pattern: RegExp): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  while (!pattern.test(text)) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`Stream ended before ${String(pattern)}: ${text}`);
    text += decoder.decode(chunk.value, { stream: true });
  }

  return text;
}

interface AWorld {
  projectId: string;
  statusIds: string[];
  labelId: string;
  commentId: string;
  ticketFile: string;
  commentFile: string;
  pendingFile: string;
}

const authHeaders = (auth: Auth): Record<string, string> =>
  auth.token ? { authorization: `Bearer ${auth.token}` } : { cookie: auth.cookie ?? '' };

// Every route that names one of A's things, with a body each would accept, so only the owner
// check stands between B and a 2xx.
const readsOf = (world: AWorld): [string, string][] => [
  ['GET', '/api/projects/MOB'],
  ['GET', '/api/projects/mob'],
  ['GET', '/api/projects/MOB/board'],
  ['GET', '/api/projects/MOB/tickets'],
  ['GET', '/api/tickets/MOB-1'],
  ['GET', '/api/tickets/mob-1'],
  ['GET', `/api/attachments/${world.ticketFile}/file`],
  ['GET', `/api/attachments/${world.commentFile}/file`],
  ['GET', `/api/attachments/${world.pendingFile}/file`],
  ['HEAD', `/api/attachments/${world.ticketFile}/file`],
];

const writesOf = (world: AWorld): [string, string, unknown?][] => [
  ['PATCH', '/api/projects/MOB', { name: 'Mine now' }],
  ['POST', '/api/projects/MOB/tickets', { title: 'Mine now' }],
  ['POST', '/api/projects/MOB/statuses', { name: 'Mine', category: 'todo' }],
  ['PUT', '/api/projects/MOB/statuses/order', { ids: world.statusIds }],
  ['POST', '/api/projects/MOB/claim'],
  ['PATCH', `/api/statuses/${world.statusIds[0]}`, { name: 'Mine' }],
  ['POST', '/api/projects/MOB/labels', { name: 'Mine' }],
  ['PUT', '/api/projects/MOB/labels/order', { ids: [world.labelId] }],
  ['PATCH', `/api/labels/${world.labelId}`, { name: 'Mine' }],
  ['DELETE', `/api/labels/${world.labelId}`],
  ['PATCH', '/api/tickets/MOB-1', { title: 'Mine now' }],
  ['POST', '/api/tickets/MOB-1/move', { statusId: world.statusIds[1] }],
  ['POST', '/api/tickets/MOB-1/comments', { text: 'Hello' }],
  ['POST', '/api/tickets/MOB-1/claim'],
  ['POST', '/api/tickets/MOB-1/submit', { summary: 'Done' }],
  ['POST', '/api/tickets/MOB-1/review', { verdict: 'approved', rating: 5, summary: 'Fine' }],
  ['PATCH', `/api/activity/${world.commentId}`, { text: 'Mine now' }],
  ['DELETE', `/api/statuses/${world.statusIds[0]}?moveTo=${world.statusIds[1]}`],
  ['DELETE', `/api/activity/${world.commentId}`],
  ['DELETE', `/api/attachments/${world.ticketFile}`],
  ['DELETE', `/api/attachments/${world.pendingFile}`],
  ['DELETE', '/api/tickets/MOB-1'],
  ['DELETE', '/api/projects/MOB'],
];

// Refused to every agent token before any lookup, so a 403 says nothing about A's project.
const personOnlyPaths = (world: AWorld) =>
  new Set([
    'PATCH /api/projects/MOB',
    'DELETE /api/projects/MOB',
    'POST /api/projects/MOB/labels',
    'PUT /api/projects/MOB/labels/order',
    `PATCH /api/labels/${world.labelId}`,
    `DELETE /api/labels/${world.labelId}`,
    'DELETE /api/tickets/MOB-1',
    `PATCH /api/activity/${world.commentId}`,
    `DELETE /api/activity/${world.commentId}`,
    `DELETE /api/attachments/${world.ticketFile}`,
    `DELETE /api/attachments/${world.pendingFile}`,
  ]);
const personOnly = (world: AWorld, method: string, path: string): boolean =>
  personOnlyPaths(world).has(`${method} ${path}`) ||
  (method !== 'GET' && path.includes('/statuses'));
const writeStatus = (world: AWorld, auth: Auth, method: string, path: string): number =>
  auth.token && personOnly(world, method, path) ? 403 : 404;

describe.each(DIALECTS)("one user's projects stay theirs (%s)", (dialect) => {
  const api = useTestServer(dialect);
  let userA: { person: Caller; auth: Auth };
  let userB: { person: Caller; agent: Caller; auths: Auth[] };
  let world: AWorld;
  const readers: Reader[] = [];

  afterEach(async () => {
    await Promise.all(readers.splice(0).map((reader) => reader.cancel()));
  });

  async function openStream(auth: Auth): Promise<Reader> {
    const response = await api.app.request('/api/events', { headers: authHeaders(auth) });
    const reader = response.body!.getReader();
    readers.push(reader);
    await readUntil(reader, /: connected\n\n/);

    return reader;
  }

  async function request(auth: Auth, method: string, path: string, body?: unknown) {
    const headers = { ...authHeaders(auth), 'content-type': 'application/json' };
    const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };

    return api.app.request(path, init);
  }

  async function upload(auth: Auth, ticketKey?: string): Promise<Response> {
    const query = ticketKey ? `?ticketKey=${ticketKey}` : '';

    return api.app.request(`/api/attachments${query}`, {
      method: 'POST',
      headers: { ...authHeaders(auth), 'content-type': 'text/plain', [FILE_NAME_HEADER]: 'a.txt' },
      body: 'notes of A',
    });
  }

  const uploaded = async (auth: Auth, ticketKey?: string) =>
    ((await (await upload(auth, ticketKey)).json()) as Attachment).id;

  async function buildA(): Promise<AWorld> {
    const project = await userA.person<ProjectDetail>('POST', '/api/projects', {
      name: 'Mobile',
      key: 'MOB',
    });
    const label = await userA.person<Label>('POST', '/api/projects/MOB/labels', { name: 'Bug' });
    await userA.person('POST', '/api/projects/MOB/tickets', { title: 'Crash', assignee: 'Dara' });
    const ticketFile = await uploaded(userA.auth, 'MOB-1');
    const commentFile = await uploaded(userA.auth);
    const comment = await userA.person<Activity>('POST', '/api/tickets/MOB-1/comments', {
      text: 'Secret note',
      attachmentIds: [commentFile],
    });

    return {
      projectId: project.body.project.id,
      statusIds: project.body.statuses.map((status) => status.id),
      labelId: label.body.id,
      commentId: comment.body.id,
      ticketFile,
      commentFile,
      pendingFile: await uploaded(userA.auth),
    };
  }

  beforeEach(async () => {
    const owner = await addUser(api.db, 'a@example.com', Date.now(), 'owner');
    const user = await addUser(api.db, 'b@example.com', Date.now() + 1);
    userA = {
      person: caller(() => api.app, owner.person),
      auth: owner.person,
    };
    userB = {
      person: caller(() => api.app, user.person),
      agent: caller(() => api.app, user.agent),
      auths: [user.person, user.agent],
    };
    world = await buildA();
  });

  it("answers 404 to B for every read of A's project, by key or id, by session and token", async () => {
    for (const auth of userB.auths) {
      for (const [method, path] of readsOf(world)) {
        const response = await request(auth, method, path);
        expect(response.status, `${method} ${path}`).toBe(404);
      }
    }
  });

  it("answers 404 to B for every change to A's project and changes nothing", async () => {
    for (const auth of userB.auths) {
      for (const [method, path, body] of writesOf(world)) {
        const response = await request(auth, method, path, body);
        expect(response.status, `${method} ${path}`).toBe(writeStatus(world, auth, method, path));
      }
    }

    const ticket = await userA.person<{ ticket: { title: string } }>('GET', '/api/tickets/MOB-1');
    expect(ticket.body.ticket.title).toBe('Crash');
    expect(
      (await request(userA.auth, 'GET', `/api/attachments/${world.ticketFile}/file`)).status,
    ).toBe(200);
  });

  it("leaves A's projects, tickets and people out of B's lists and search", async () => {
    for (const as of [userB.person, userB.agent]) {
      expect((await as<ProjectSummary[]>('GET', '/api/projects')).body).toEqual([]);
      const all = await as<TicketsAcrossProjects>('GET', '/api/tickets?q=Crash');
      expect(all.body).toEqual({ tickets: [], statuses: [], labels: [] });
      const found = await as<TicketSearchResults>('GET', '/api/search?q=Crash');
      expect(found.body).toEqual({ tickets: [] });
      expect((await as<TicketSearchResults>('GET', '/api/search?q=MOB-1')).body.tickets).toEqual(
        [],
      );
      expect((await as<TicketSearchResults>('GET', '/api/search')).body.tickets).toEqual([]);
      const ready = await as<TicketsAcrossProjects>('GET', '/api/tickets?category=todo');
      expect(ready.body.tickets).toEqual([]);
      expect((await as<string[]>('GET', '/api/people')).body).toEqual([]);
    }

    expect((await userA.person<ProjectSummary[]>('GET', '/api/projects')).body).toHaveLength(1);
    const own = await userA.person<TicketSearchResults>('GET', '/api/search?q=Crash');
    expect(own.body.tickets.map((ticket) => ticket.key)).toEqual(['MOB-1']);
  });

  it("won't let B upload to A's ticket or attach A's file to B's own ticket", async () => {
    expect((await upload(userB.auths[0]!, 'MOB-1')).status).toBe(404);
    await userB.person('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    const stolen = await userB.person('POST', '/api/projects/WEB/tickets', {
      title: 'Mine',
      attachmentIds: [world.pendingFile],
    });
    expect(stolen.status).toBe(400);
    expect(
      (await request(userA.auth, 'GET', `/api/attachments/${world.pendingFile}/file`)).status,
    ).toBe(200);
  });

  it('gives B a project of its own under a free key, without telling it whose MOB is', async () => {
    const created = await userB.person<ProjectDetail>('POST', '/api/projects', {
      name: 'Mobile',
      key: 'MOB',
    });
    expect(created.status).toBe(201);
    expect(created.body.project.key).not.toBe('MOB');
    expect((await userB.person<ProjectSummary[]>('GET', '/api/projects')).body).toHaveLength(1);
    expect((await userA.person<ProjectSummary[]>('GET', '/api/projects')).body).toHaveLength(1);
  });

  it("never streams A's changes to B, by session or by token", async () => {
    const [aStream, ...bStreams] = await Promise.all([userA.auth, ...userB.auths].map(openStream));
    await userA.person('PATCH', '/api/tickets/MOB-1', { title: 'Renamed' });
    await userA.person('POST', '/api/tickets/MOB-1/comments', { text: 'More' });
    await userA.person('DELETE', '/api/projects/MOB');
    expect(await readUntil(aStream!, /"ticketId":null/)).toContain(world.projectId);
    // Writes keep their order, so B's own change arriving means none of A's went to B.
    const own = await userB.person<ProjectDetail>('POST', '/api/projects', { name: 'Web' });
    for (const reader of bStreams) {
      const text = await readUntil(reader, new RegExp(own.body.project.id));
      expect(text).not.toContain(world.projectId);
    }
  });
});
