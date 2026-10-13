import { randomUUID } from 'node:crypto';
import {
  FILE_NAME_HEADER,
  type Activity,
  type Attachment,
  type ChatDetail,
  type Label,
  type ProjectDetail,
  type ProjectSummary,
  type Run,
  type TicketsAcrossProjects,
} from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
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
  chatId: string;
  runId: string;
}

const authHeaders = (auth: Auth): Record<string, string> =>
  auth.token ? { authorization: `Bearer ${auth.token}` } : { cookie: auth.cookie ?? '' };

// Every route that names one of A's things, with a body each would accept, so only the owner
// check stands between B and a 2xx.
const readsOf = (a: AWorld): [string, string][] => [
  ['GET', '/api/projects/MOB'],
  ['GET', '/api/projects/mob'],
  ['GET', '/api/projects/MOB/board'],
  ['GET', '/api/projects/MOB/prompt'],
  ['GET', '/api/projects/MOB/tickets'],
  ['GET', '/api/projects/MOB/chats'],
  ['GET', '/api/tickets/MOB-1'],
  ['GET', '/api/tickets/mob-1'],
  ['GET', '/api/tickets/MOB-1/prompt'],
  ['GET', '/api/tickets/MOB-1/runs'],
  ['GET', `/api/attachments/${a.ticketFile}/file`],
  ['GET', `/api/attachments/${a.commentFile}/file`],
  ['GET', `/api/attachments/${a.pendingFile}/file`],
  ['HEAD', `/api/attachments/${a.ticketFile}/file`],
  ['GET', `/api/chats/${a.chatId}`],
  ['GET', `/api/runs/${a.runId}`],
];

const writesOf = (a: AWorld): [string, string, unknown?][] => [
  ['PATCH', '/api/projects/MOB', { name: 'Mine now' }],
  ['POST', '/api/projects/MOB/tickets', { title: 'Mine now' }],
  ['POST', '/api/projects/MOB/statuses', { name: 'Mine', category: 'todo' }],
  ['PUT', '/api/projects/MOB/statuses/order', { ids: a.statusIds }],
  ['POST', '/api/projects/MOB/claim'],
  ['PATCH', `/api/statuses/${a.statusIds[0]}`, { name: 'Mine' }],
  ['POST', '/api/projects/MOB/labels', { name: 'Mine' }],
  ['PUT', '/api/projects/MOB/labels/order', { ids: [a.labelId] }],
  ['PATCH', `/api/labels/${a.labelId}`, { name: 'Mine' }],
  ['DELETE', `/api/labels/${a.labelId}`],
  ['PATCH', '/api/tickets/MOB-1', { title: 'Mine now' }],
  ['POST', '/api/tickets/MOB-1/move', { statusId: a.statusIds[1] }],
  ['POST', '/api/tickets/MOB-1/sent', { moveToInProgress: true }],
  ['POST', '/api/tickets/MOB-1/comments', { text: 'Hello' }],
  ['POST', '/api/tickets/MOB-1/claim'],
  ['POST', '/api/tickets/MOB-1/submit', { summary: 'Done' }],
  ['POST', '/api/tickets/MOB-1/review', { verdict: 'approved', rating: 5, summary: 'Fine' }],
  ['PATCH', `/api/activity/${a.commentId}`, { text: 'Mine now' }],
  ['POST', `/api/runs/${a.runId}/cancel`],
  ['DELETE', `/api/statuses/${a.statusIds[0]}?moveTo=${a.statusIds[1]}`],
  ['DELETE', `/api/activity/${a.commentId}`],
  ['DELETE', `/api/attachments/${a.ticketFile}`],
  ['DELETE', `/api/attachments/${a.pendingFile}`],
  ['DELETE', '/api/tickets/MOB-1'],
  ['DELETE', '/api/projects/MOB'],
];

// Refused to every agent token before any lookup, so a 403 says nothing about A's project.
const personOnly = (a: AWorld) =>
  new Set([
    'PATCH /api/projects/MOB',
    'DELETE /api/projects/MOB',
    'POST /api/projects/MOB/labels',
    'PUT /api/projects/MOB/labels/order',
    `PATCH /api/labels/${a.labelId}`,
    `DELETE /api/labels/${a.labelId}`,
  ]);
const writeStatus = (a: AWorld, auth: Auth, request: string): number =>
  auth.token && personOnly(a).has(request) ? 403 : 404;

describe.each(DIALECTS)("one user's projects stay theirs (%s)", (dialect) => {
  const api = useTestServer(dialect);
  const aRunner = randomUUID();
  let a: { person: Caller; helper: Caller; auth: Auth };
  let b: { person: Caller; helper: Caller; auths: Auth[] };
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
    const project = await a.person<ProjectDetail>('POST', '/api/projects', {
      name: 'Mobile',
      key: 'MOB',
    });
    const label = await a.person<Label>('POST', '/api/projects/MOB/labels', { name: 'Bug' });
    await a.person('POST', '/api/projects/MOB/tickets', { title: 'Crash', assignee: 'Dara' });
    const ticketFile = await uploaded(a.auth, 'MOB-1');
    const commentFile = await uploaded(a.auth);
    const comment = await a.person<Activity>('POST', '/api/tickets/MOB-1/comments', {
      text: 'Secret note',
      attachmentIds: [commentFile],
    });
    await a.helper('PUT', `/api/runners/${aRunner}`, helperName('A Mac'));
    const chat = await a.person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: aRunner,
      text: 'Why?',
    });
    const run = await a.person<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: aRunner,
      prompt: 'Go',
    });
    return {
      projectId: project.body.project.id,
      statusIds: project.body.statuses.map((status) => status.id),
      labelId: label.body.id,
      commentId: comment.body.id,
      ticketFile,
      commentFile,
      pendingFile: await uploaded(a.auth),
      chatId: chat.body.chat.id,
      runId: run.body.id,
    };
  }

  beforeEach(async () => {
    const owner = await addUser(api.db, 'a@example.com', Date.now(), 'owner');
    const user = await addUser(api.db, 'b@example.com', Date.now() + 1);
    a = {
      person: caller(() => api.app, owner.person),
      helper: caller(() => api.app, owner.helper),
      auth: owner.person,
    };
    b = {
      person: caller(() => api.app, user.person),
      helper: caller(() => api.app, user.helper),
      auths: [user.person, user.helper],
    };
    world = await buildA();
  });

  it("answers 404 to B for every read of A's project, by key or id, by session and token", async () => {
    for (const auth of b.auths) {
      for (const [method, path] of readsOf(world)) {
        const response = await request(auth, method, path);
        expect(response.status, `${method} ${path}`).toBe(404);
      }
    }
  });

  it("answers 404 to B for every change to A's project and changes nothing", async () => {
    for (const auth of b.auths) {
      for (const [method, path, body] of writesOf(world)) {
        const response = await request(auth, method, path, body);
        expect(response.status, `${method} ${path}`).toBe(
          writeStatus(world, auth, `${method} ${path}`),
        );
      }
    }
    const ticket = await a.person<{ ticket: { title: string } }>('GET', '/api/tickets/MOB-1');
    expect(ticket.body.ticket.title).toBe('Crash');
    expect((await request(a.auth, 'GET', `/api/attachments/${world.ticketFile}/file`)).status).toBe(
      200,
    );
    expect((await request(a.auth, 'GET', `/api/chats/${world.chatId}`)).status).toBe(200);
  });

  it("leaves A's projects, tickets and people out of B's lists and search", async () => {
    for (const as of [b.person, b.helper]) {
      expect((await as<ProjectSummary[]>('GET', '/api/projects')).body).toEqual([]);
      const all = await as<TicketsAcrossProjects>('GET', '/api/tickets?q=Crash');
      expect(all.body).toEqual({ tickets: [], statuses: [], labels: [] });
      const ready = await as<TicketsAcrossProjects>('GET', '/api/tickets?category=todo');
      expect(ready.body.tickets).toEqual([]);
      expect((await as<string[]>('GET', '/api/people')).body).toEqual([]);
    }
    expect((await a.person<ProjectSummary[]>('GET', '/api/projects')).body).toHaveLength(1);
  });

  it("matches no ticket of A's in B's pasted report", async () => {
    const text = 'TICKET: MOB-1\nSTATUS: done\nSUMMARY: Mine';
    const preview = await b.person<{ matchedCount: number }>('POST', '/api/reports/preview', {
      text,
    });
    expect(preview.body.matchedCount).toBe(0);
    expect((await b.person('POST', '/api/reports/apply', { text })).status).toBe(422);
  });

  it("won't let B upload to A's ticket or attach A's file to B's own ticket", async () => {
    expect((await upload(b.auths[0]!, 'MOB-1')).status).toBe(404);
    await b.person('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    const stolen = await b.person('POST', '/api/projects/WEB/tickets', {
      title: 'Mine',
      attachmentIds: [world.pendingFile],
    });
    expect(stolen.status).toBe(400);
    expect(
      (await request(a.auth, 'GET', `/api/attachments/${world.pendingFile}/file`)).status,
    ).toBe(200);
  });

  it("won't let B's session, token or helper start a run on A's project", async () => {
    const bRunner = randomUUID();
    const serve = await b.helper('PUT', `/api/runners/${bRunner}`, helperName('B Mac'));
    expect(serve.status).toBe(404);
    const start = { runnerId: aRunner, prompt: 'Go' };
    expect((await b.person('POST', '/api/tickets/MOB-1/runs', start)).status).toBe(404);
    // A token is an agent, and agents never start runs, whose ticket it is or not.
    expect((await b.helper('POST', '/api/tickets/MOB-1/runs', start)).status).toBe(403);
    const chat = { runnerId: aRunner, text: 'Mine?' };
    expect((await b.person('POST', '/api/projects/MOB/chats', chat)).status).toBe(404);
    const ask = await b.person('POST', `/api/chats/${world.chatId}/messages`, chat);
    expect(ask.status).toBe(404);
  });

  it('gives B a project of its own under a free key, without telling it whose MOB is', async () => {
    const created = await b.person<ProjectDetail>('POST', '/api/projects', {
      name: 'Mobile',
      key: 'MOB',
    });
    expect(created.status).toBe(201);
    expect(created.body.project.key).not.toBe('MOB');
    expect((await b.person<ProjectSummary[]>('GET', '/api/projects')).body).toHaveLength(1);
    expect((await a.person<ProjectSummary[]>('GET', '/api/projects')).body).toHaveLength(1);
  });

  it("never streams A's changes to B, by session or by token", async () => {
    const [aStream, ...bStreams] = await Promise.all([a.auth, ...b.auths].map(openStream));
    await a.person('PATCH', '/api/tickets/MOB-1', { title: 'Renamed' });
    await a.person('POST', '/api/tickets/MOB-1/comments', { text: 'More' });
    await a.person('DELETE', '/api/projects/MOB');
    expect(await readUntil(aStream!, /"ticketId":null/)).toContain(world.projectId);
    // Writes keep their order, so B's own change arriving means none of A's went to B.
    const own = await b.person<ProjectDetail>('POST', '/api/projects', { name: 'Web' });
    for (const reader of bStreams) {
      const text = await readUntil(reader, new RegExp(own.body.project.id));
      expect(text).not.toContain(world.projectId);
    }
  });
});
