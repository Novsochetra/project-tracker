import { FILE_NAME_HEADER } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, FRESH_READ_HEADER, TrackerClient, type HttpOptions } from '../src';

interface Call {
  url: string;
  init: RequestInit;
}

interface Route {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  call: (client: TrackerClient) => Promise<unknown>;
}

const BASE = 'http://tracker.test';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const noContent = () => new Response(null, { status: 204 });

function setup(respond: () => Response = () => json({}), options: Partial<HttpOptions> = {}) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) => {
    if (typeof input !== 'string') throw new Error('The client should pass URLs as strings.');
    calls.push({ url: input, init });

    return Promise.resolve(respond());
  };

  const client = new TrackerClient({ baseUrl: `${BASE}/`, fetch, ...options });

  return { client, calls, last: () => calls.at(-1)! };
}

const pathOf = (call: Call) => call.url.slice(BASE.length);
const headersOf = (call: Call) => new Headers(call.init.headers);
const jsonBody = (call: Call): unknown => JSON.parse(call.init.body as string);

const routes: Route[] = [
  {
    name: 'getPushKey',
    method: 'GET',
    path: '/api/push/key',
    call: (client) => client.getPushKey(),
  },
  {
    name: 'savePushSubscription',
    method: 'PUT',
    path: '/api/push/subscription',
    body: { endpoint: 'https://web.push.apple.com/a', keys: { p256dh: 'p', auth: 'a' } },
    call: (client) =>
      client.savePushSubscription({
        endpoint: 'https://web.push.apple.com/a',
        keys: { p256dh: 'p', auth: 'a' },
      }),
  },
  {
    name: 'removePushSubscription',
    method: 'DELETE',
    path: '/api/push/subscription',
    body: { endpoint: 'https://web.push.apple.com/a' },
    call: (client) => client.removePushSubscription('https://web.push.apple.com/a'),
  },
  {
    name: 'listProjects',
    method: 'GET',
    path: '/api/projects',
    call: (client) => client.listProjects(),
  },
  {
    name: 'createProject',
    method: 'POST',
    path: '/api/projects',
    body: { name: 'Mobile app', key: 'mob', repo: '~/code/mobile' },
    call: (client) =>
      client.createProject({ name: 'Mobile app', key: 'mob', repo: '~/code/mobile' }),
  },
  {
    name: 'getProject',
    method: 'GET',
    path: '/api/projects/MOB',
    call: (client) => client.getProject('MOB'),
  },
  {
    name: 'updateProject',
    method: 'PATCH',
    path: '/api/projects/MOB',
    body: { description: 'iOS and Android' },
    call: (client) => client.updateProject('MOB', { description: 'iOS and Android' }),
  },
  {
    name: 'deleteProject',
    method: 'DELETE',
    path: '/api/projects/MOB',
    call: (client) => client.deleteProject('MOB'),
  },
  {
    name: 'getBoard',
    method: 'GET',
    path: '/api/projects/MOB/board',
    call: (client) => client.getBoard('MOB'),
  },
  {
    name: 'createStatus',
    method: 'POST',
    path: '/api/projects/MOB/statuses',
    body: { name: 'QA', category: 'in_review', color: '#0B68CB' },
    call: (client) =>
      client.createStatus('MOB', { name: 'QA', category: 'in_review', color: '#0B68CB' }),
  },
  {
    name: 'updateStatus',
    method: 'PATCH',
    path: '/api/statuses/s1',
    body: { name: 'Testing' },
    call: (client) => client.updateStatus('s1', { name: 'Testing' }),
  },
  {
    name: 'reorderStatuses',
    method: 'PUT',
    path: '/api/projects/MOB/statuses/order',
    body: { ids: ['s2', 's1'] },
    call: (client) => client.reorderStatuses('MOB', ['s2', 's1']),
  },
  {
    name: 'deleteStatus',
    method: 'DELETE',
    path: '/api/statuses/s1',
    call: (client) => client.deleteStatus('s1'),
  },
  {
    name: 'listTickets',
    method: 'GET',
    path: '/api/projects/MOB/tickets',
    call: (client) => client.listTickets('MOB'),
  },
  {
    name: 'listAllTickets',
    method: 'GET',
    path: '/api/tickets',
    call: (client) => client.listAllTickets(),
  },
  {
    name: 'createTicket',
    method: 'POST',
    path: '/api/projects/MOB/tickets',
    body: { title: 'Fix login', priority: 'high', attachmentIds: ['f1'] },
    call: (client) =>
      client.createTicket('MOB', { title: 'Fix login', priority: 'high', attachmentIds: ['f1'] }),
  },
  {
    name: 'getTicket',
    method: 'GET',
    path: '/api/tickets/MOB-3',
    call: (client) => client.getTicket('MOB-3'),
  },
  {
    name: 'updateTicket',
    method: 'PATCH',
    path: '/api/tickets/MOB-3',
    body: { priority: 'low', due: '2026-10-09' },
    call: (client) => client.updateTicket('MOB-3', { priority: 'low', due: '2026-10-09' }),
  },
  {
    name: 'updateTicket with the text it was typed over',
    method: 'PATCH',
    path: '/api/tickets/MOB-3',
    body: { title: 'Fix login now', expected: { title: 'Fix login' } },
    call: (client) =>
      client.updateTicket('MOB-3', { title: 'Fix login now' }, { title: 'Fix login' }),
  },
  {
    name: 'moveTicket',
    method: 'POST',
    path: '/api/tickets/MOB-3/move',
    body: { statusId: 's2', beforeId: 't1', afterId: null },
    call: (client) => client.moveTicket('MOB-3', { statusId: 's2', beforeId: 't1', afterId: null }),
  },
  {
    name: 'deleteTicket',
    method: 'DELETE',
    path: '/api/tickets/MOB-3',
    call: (client) => client.deleteTicket('MOB-3'),
  },
  {
    name: 'addComment',
    method: 'POST',
    path: '/api/tickets/MOB-3/comments',
    body: { text: 'Looks good', attachmentIds: ['f1'] },
    call: (client) => client.addComment('MOB-3', { text: 'Looks good', attachmentIds: ['f1'] }),
  },
  {
    name: 'updateComment',
    method: 'PATCH',
    path: '/api/activity/a1',
    body: { text: 'Edited' },
    call: (client) => client.updateComment('a1', { text: 'Edited' }),
  },
  {
    name: 'updateComment with the text it was typed over',
    method: 'PATCH',
    path: '/api/activity/a1',
    body: { text: 'Edited', expected: { text: 'First' } },
    call: (client) => client.updateComment('a1', { text: 'Edited' }, { text: 'First' }),
  },
  {
    name: 'deleteActivity',
    method: 'DELETE',
    path: '/api/activity/a1',
    call: (client) => client.deleteActivity('a1'),
  },
  {
    name: 'deleteAttachment',
    method: 'DELETE',
    path: '/api/attachments/f1',
    call: (client) => client.deleteAttachment('f1'),
  },
  {
    name: 'claimNext',
    method: 'POST',
    path: '/api/projects/MOB/claim',
    call: (client) => client.claimNext('MOB'),
  },
  {
    name: 'claimTicket',
    method: 'POST',
    path: '/api/tickets/MOB-3/claim',
    call: (client) => client.claimTicket('MOB-3'),
  },
  {
    name: 'submitForReview',
    method: 'POST',
    path: '/api/tickets/MOB-3/submit',
    body: { summary: 'Added the error', files: 'src/login.tsx', next: 'none' },
    call: (client) =>
      client.submitForReview('MOB-3', {
        summary: 'Added the error',
        files: 'src/login.tsx',
        next: 'none',
      }),
  },
  {
    name: 'reviewTicket',
    method: 'POST',
    path: '/api/tickets/MOB-3/review',
    body: { verdict: 'changes_requested', rating: 2, summary: 'Wrong field' },
    call: (client) =>
      client.reviewTicket('MOB-3', {
        verdict: 'changes_requested',
        rating: 2,
        summary: 'Wrong field',
      }),
  },
  { name: 'listPeople', method: 'GET', path: '/api/people', call: (client) => client.listPeople() },
  {
    name: 'checkHealth',
    method: 'GET',
    path: '/api/health',
    call: (client) => client.checkHealth(),
  },
  {
    name: 'getSession',
    method: 'GET',
    path: '/api/session',
    call: (client) => client.getSession(),
  },
  {
    name: 'login',
    method: 'POST',
    path: '/api/session',
    body: { email: 'owner@example.com', password: 'a long password' },
    call: (client) => client.login({ email: 'owner@example.com', password: 'a long password' }),
  },
  { name: 'logout', method: 'DELETE', path: '/api/session', call: (client) => client.logout() },
  {
    name: 'signOutEverywhere',
    method: 'DELETE',
    path: '/api/sessions',
    call: (client) => client.signOutEverywhere(),
  },
  {
    name: 'listApiTokens',
    method: 'GET',
    path: '/api/tokens',
    call: (client) => client.listApiTokens(),
  },
  {
    name: 'createApiToken',
    method: 'POST',
    path: '/api/tokens',
    body: { name: 'Claude laptop' },
    call: (client) => client.createApiToken({ name: 'Claude laptop' }),
  },
  {
    name: 'revokeApiToken',
    method: 'DELETE',
    path: '/api/tokens/t%2F1',
    call: (client) => client.revokeApiToken('t/1'),
  },
  {
    name: 'askQuestion',
    method: 'POST',
    path: '/api/tickets/MOB-3/questions',
    body: { question: 'Dark or night?', choices: ['Dark', 'Night'] },
    call: (client) =>
      client.askQuestion('MOB-3', { question: 'Dark or night?', choices: ['Dark', 'Night'] }),
  },
  {
    name: 'listQuestions',
    method: 'GET',
    path: '/api/tickets/MOB-3/questions',
    call: (client) => client.listQuestions('MOB-3'),
  },
  {
    name: 'answerQuestion',
    method: 'POST',
    path: '/api/questions/q%201/answer',
    body: { answer: 'Night' },
    call: (client) => client.answerQuestion('q 1', { answer: 'Night' }),
  },
  {
    name: 'waitForQuestion',
    method: 'GET',
    path: '/api/questions/q-1/wait',
    call: (client) => client.waitForQuestion('q-1'),
  },
  {
    name: 'cancelQuestion',
    method: 'POST',
    path: '/api/questions/q-1/cancel',
    call: (client) => client.cancelQuestion('q-1'),
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it.each(routes)('$name sends $method $path', async ({ method, path, call }) => {
    const { client, last } = setup();

    await call(client);

    expect(last().init.method).toBe(method);
    expect(pathOf(last())).toBe(path);
  });

  it.each(routes)('$name sends the expected body', async ({ body, call }) => {
    const { client, last } = setup();

    await call(client);

    if (body === undefined) {
      expect(last().init.body).toBeUndefined();
      expect(headersOf(last()).has('content-type')).toBe(false);
    } else {
      expect(jsonBody(last())).toEqual(body);
      expect(headersOf(last()).get('content-type')).toBe('application/json');
    }
  });

  it('drops the trailing slash of the base URL', async () => {
    const { client, last } = setup();

    await client.listProjects();

    expect(last().url).toBe('http://tracker.test/api/projects');
  });

  it('builds relative URLs from an empty base URL', async () => {
    const { client, last } = setup(undefined, { baseUrl: '' });

    await client.getTicket('MOB-3');

    expect(last().url).toBe('/api/tickets/MOB-3');
  });

  it('encodes keys and ids as single path segments', async () => {
    const { client, calls } = setup();

    await client.getTicket('MOB 3/x?y#z');
    await client.getProject('a/b');
    await client.updateStatus('s 1', {});
    await client.deleteActivity('a&1');

    expect(calls.map(pathOf)).toEqual([
      '/api/tickets/MOB%203%2Fx%3Fy%23z',
      '/api/projects/a%2Fb',
      '/api/statuses/s%201',
      '/api/activity/a%261',
    ]);
  });
});

describe('query strings', () => {
  it('builds the ticket list query and drops empty values', async () => {
    const { client, last } = setup(() => json([]));

    await client.listTickets('MOB', { status: 'In progress', category: 'in_progress', q: '' });

    expect(pathOf(last())).toBe(
      '/api/projects/MOB/tickets?status=In+progress&category=in_progress',
    );
  });

  it('sends no query string when every value is empty', async () => {
    const { client, calls } = setup(() => json([]));

    await client.listTickets('MOB', { status: '', q: undefined });
    await client.listTickets('MOB');

    expect(calls.map(pathOf)).toEqual(['/api/projects/MOB/tickets', '/api/projects/MOB/tickets']);
  });

  it('encodes query values', async () => {
    const { client, last } = setup(() => json([]));

    await client.listTickets('MOB', { q: 'mob-3 & co/x' });

    expect(pathOf(last())).toBe('/api/projects/MOB/tickets?q=mob-3+%26+co%2Fx');
  });

  it('builds the same query for tickets across projects', async () => {
    const { client, calls } = setup(() => json([]));

    await client.listAllTickets({ category: 'reviewed' });
    await client.listAllTickets({ status: 'Reviewed', q: 'web-2 & co', category: undefined });

    expect(calls.map(pathOf)).toEqual([
      '/api/tickets?category=reviewed',
      '/api/tickets?status=Reviewed&q=web-2+%26+co',
    ]);
  });

  it('adds moveTo when deleting a status only when it is given', async () => {
    const { client, calls } = setup(noContent);

    await client.deleteStatus('s1', 's 2');
    await client.deleteStatus('s1');

    expect(calls.map(pathOf)).toEqual(['/api/statuses/s1?moveTo=s+2', '/api/statuses/s1']);
  });
});

describe('headers', () => {
  it('sends the token as a bearer authorization header', async () => {
    const { client, last } = setup(undefined, { token: 'secret-token' });

    await client.listProjects();

    expect(headersOf(last()).get('authorization')).toBe('Bearer secret-token');
  });

  it('sends the actor kind and the URI-encoded actor name', async () => {
    const actor = { kind: 'agent' as const, name: 'Claude Code · worker 2' };
    const { client, last } = setup(undefined, { actor });

    await client.claimNext('MOB');

    const headers = headersOf(last());
    expect(headers.get('x-actor-kind')).toBe('agent');
    expect(headers.get('x-actor-name')).toBe('Claude%20Code%20%C2%B7%20worker%202');
    expect(decodeURIComponent(headers.get('x-actor-name') ?? '')).toBe(actor.name);
  });

  it('sends no authorization or actor headers when none are configured', async () => {
    const { client, last } = setup();

    await client.listProjects();

    const headers = headersOf(last());
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('x-actor-kind')).toBe(false);
    expect(headers.has('x-actor-name')).toBe(false);
  });

  it('sends the same headers when fetching an attachment file', async () => {
    const { client, last } = setup(() => new Response('bytes'), {
      token: 't0k',
      actor: { kind: 'human', name: 'Dara' },
    });

    await client.fetchAttachment('f1');

    const headers = headersOf(last());
    expect(headers.get('authorization')).toBe('Bearer t0k');
    expect(headers.get('x-actor-kind')).toBe('human');
    expect(headers.get('x-actor-name')).toBe('Dara');
    expect(headers.has('content-type')).toBe(false);
  });
});

describe('fresh reads', () => {
  it('skip the browser cache, with a header the service worker never answers from cache', async () => {
    const { client, calls } = setup();

    await client.getTicket('MOB-3', { fresh: true });
    await client.listTickets('MOB', { q: 'login' }, { fresh: true });
    await client.checkHealth();

    for (const call of calls) {
      expect(headersOf(call).get(FRESH_READ_HEADER)).toBe('1');
      expect(call.init.cache).toBe('no-store');
    }

    expect(pathOf(calls[1]!)).toBe('/api/projects/MOB/tickets?q=login');
  });

  it('are not the default', async () => {
    const { client, last } = setup();

    await client.getTicket('MOB-3');

    expect(headersOf(last()).has(FRESH_READ_HEADER)).toBe(false);
    expect(last().init.cache).toBeUndefined();
  });

  it('can stop a health check that waits too long', async () => {
    const { client, last } = setup();
    const controller = new AbortController();

    await client.checkHealth({ signal: controller.signal });

    expect(last().init.signal).toBe(controller.signal);
  });

  it('can stop waiting for the answer to a question', async () => {
    const { client, last } = setup();
    const controller = new AbortController();

    await client.waitForQuestion('q-1', { signal: controller.signal });

    expect(last().init.signal).toBe(controller.signal);
  });
});

describe('uploadAttachment', () => {
  const image = () => new Blob(['png-bytes'], { type: 'image/png' });

  it('posts the file itself, its name and type in headers and the ticket key in the query', async () => {
    const { client, last } = setup(() => json({ id: 'f1' }, 201));

    await client.uploadAttachment(image(), 'shot.png', 'MOB-3');

    expect(last().init.method).toBe('POST');
    expect(pathOf(last())).toBe('/api/attachments?ticketKey=MOB-3');
    const body = last().init.body as Blob;
    expect(body).toBeInstanceOf(Blob);
    expect(await body.text()).toBe('png-bytes');
    expect(headersOf(last()).get('content-type')).toBe('image/png');
    expect(headersOf(last()).get(FILE_NAME_HEADER)).toBe('shot.png');
  });

  it('leaves out the ticket key for a pending upload', async () => {
    const { client, last } = setup(() => json({ id: 'f1' }, 201));

    await client.uploadAttachment(image(), 'shot.png');

    expect(pathOf(last())).toBe('/api/attachments');
  });

  it('percent-encodes the name, since a header carries only ASCII', async () => {
    const { client, last } = setup(() => json({ id: 'f1' }, 201));

    await client.uploadAttachment(image(), 'ការងារ 📄.png');

    expect(decodeURIComponent(headersOf(last()).get(FILE_NAME_HEADER) ?? '')).toBe('ការងារ 📄.png');
    expect(headersOf(last()).get(FILE_NAME_HEADER)).toMatch(/^[\x20-\x7e]+$/);
  });

  it('sends a file without a type as application/octet-stream, as browsers do', async () => {
    const { client, last } = setup(() => json({ id: 'f1' }, 201));

    await client.uploadAttachment(new Blob(['log line']), 'server.log');

    expect(headersOf(last()).get('content-type')).toBe('application/octet-stream');
  });

  it('passes an abort signal to fetch', async () => {
    const { client, last } = setup(() => json({ id: 'f1' }, 201));
    const controller = new AbortController();

    await client.uploadAttachment(image(), 'shot.png', undefined, { signal: controller.signal });

    expect(last().init.signal).toBe(controller.signal);
  });
});

// Only XMLHttpRequest reports how much of a request body has gone out; fetch can't.
describe('uploadAttachment with progress', () => {
  interface Sent {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  }

  class FakeXhr {
    static sent: Sent[] = [];
    static latest: FakeXhr | null = null;
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 0;
    statusText = '';
    responseText = '';
    private request: Sent = { method: '', url: '', headers: {}, body: null };

    open(method: string, url: string) {
      this.request = { ...this.request, method, url };
    }

    setRequestHeader(name: string, value: string) {
      this.request.headers[name] = value;
    }

    send(body: unknown) {
      FakeXhr.sent.push({ ...this.request, body });
      FakeXhr.latest = this;
    }

    abort() {
      this.onabort?.();
    }

    progress(loaded: number, total: number) {
      this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
    }

    answer(status: number, body: unknown) {
      this.status = status;
      this.responseText = JSON.stringify(body);
      this.onload?.();
    }
  }

  const image = () => new Blob(['png-bytes'], { type: 'image/png' });
  const latest = () => FakeXhr.latest!;

  function setupXhr(options: Partial<HttpOptions> = {}) {
    FakeXhr.sent = [];
    FakeXhr.latest = null;
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const fetch = vi.fn();
    const client = new TrackerClient({ baseUrl: `${BASE}/`, fetch, ...options });

    return { client, fetch };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports how much of the file has gone out, then returns the attachment', async () => {
    const { client, fetch } = setupXhr({
      token: 'secret',
      actor: { kind: 'agent', name: 'Cláude' },
    });
    const onProgress = vi.fn();

    const uploaded = client.uploadAttachment(image(), 'shot.png', 'MOB-3', { onProgress });
    latest().progress(4, 9);
    latest().progress(9, 9);
    latest().answer(201, { id: 'f1' });

    await expect(uploaded).resolves.toEqual({ id: 'f1' });
    expect(onProgress.mock.calls).toEqual([
      [4, 9],
      [9, 9],
    ]);
    const [sent] = FakeXhr.sent;
    expect(sent?.method).toBe('POST');
    expect(sent?.url).toBe(`${BASE}/api/attachments?ticketKey=MOB-3`);
    expect(sent?.headers).toEqual({
      authorization: 'Bearer secret',
      'content-type': 'image/png',
      [FILE_NAME_HEADER]: 'shot.png',
      'x-actor-kind': 'agent',
      'x-actor-name': 'Cl%C3%A1ude',
    });
    expect(await (sent?.body as Blob).text()).toBe('png-bytes');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws the API error the server answers with', async () => {
    const { client } = setupXhr();

    const uploaded = client.uploadAttachment(image(), 'big.mov', undefined, {
      onProgress: vi.fn(),
    });
    latest().answer(400, {
      error: { code: 'invalid_input', message: 'Videos can be up to 100 MB.' },
    });

    await expect(uploaded).rejects.toEqual(
      new ApiError(400, 'invalid_input', 'Videos can be up to 100 MB.'),
    );
  });

  it('fails like fetch when the network does', async () => {
    const { client } = setupXhr();

    const uploaded = client.uploadAttachment(image(), 'shot.png', undefined, {
      onProgress: vi.fn(),
    });
    latest().onerror?.();

    await expect(uploaded).rejects.toBeInstanceOf(TypeError);
  });

  it('stops the upload when its signal aborts', async () => {
    const { client } = setupXhr();
    const controller = new AbortController();

    const uploaded = client.uploadAttachment(image(), 'shot.png', undefined, {
      onProgress: vi.fn(),
      signal: controller.signal,
    });
    controller.abort();

    await expect(uploaded).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('never sends when the signal has already aborted', async () => {
    const { client } = setupXhr();
    const controller = new AbortController();
    controller.abort();

    const uploaded = client.uploadAttachment(image(), 'shot.png', undefined, {
      onProgress: vi.fn(),
      signal: controller.signal,
    });

    await expect(uploaded).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXhr.sent).toEqual([]);
  });

  it('falls back to fetch where XMLHttpRequest does not exist', async () => {
    vi.stubGlobal('XMLHttpRequest', undefined);
    const { client, last } = setup(() => json({ id: 'f1' }, 201));

    await expect(
      client.uploadAttachment(image(), 'shot.png', undefined, { onProgress: vi.fn() }),
    ).resolves.toEqual({ id: 'f1' });
    expect(pathOf(last())).toBe('/api/attachments');
  });
});

describe('responses', () => {
  it('returns the parsed JSON body', async () => {
    const { client } = setup(() => json(['Dara', 'Sophea']));

    await expect(client.listPeople()).resolves.toEqual(['Dara', 'Sophea']);
  });

  it('returns undefined for 204 No Content', async () => {
    const { client } = setup(noContent);

    await expect(client.deleteTicket('MOB-3')).resolves.toBeUndefined();
  });

  it('returns null from claimNext when no ticket is ready (204)', async () => {
    const { client } = setup(noContent);

    await expect(client.claimNext('MOB')).resolves.toBeNull();
  });

  it('returns the claimed ticket from claimNext', async () => {
    const detail = { ticket: { key: 'MOB-3' }, activity: [] };
    const { client } = setup(() => json(detail));

    await expect(client.claimNext('MOB')).resolves.toEqual(detail);
  });

  it('returns null for an empty success body', async () => {
    const { client } = setup(() => new Response('', { status: 200 }));

    await expect(client.getBoard('MOB')).resolves.toBeNull();
  });

  it('returns the raw response from fetchAttachment', async () => {
    const { client, last } = setup(() => new Response('bytes', { status: 200 }));

    const response = await client.fetchAttachment('f 1');

    expect(await response.text()).toBe('bytes');
    expect(pathOf(last())).toBe('/api/attachments/f%201/file');
    expect(last().init.method).toBeUndefined();
  });

  it('passes a signal to fetchAttachment, so a download can be stopped', async () => {
    const { client, last } = setup(() => new Response('bytes', { status: 200 }));
    const stop = new AbortController();

    await client.fetchAttachment('f1', { signal: stop.signal });

    expect(last().init.signal).toBe(stop.signal);
  });

  it('returns the file as UTF-8 text from fetchAttachmentText', async () => {
    const text = 'line one\nlíne twö 📄';
    const { client, last } = setup(() => new Response(text, { status: 200 }));

    await expect(client.fetchAttachmentText('f 1')).resolves.toBe(text);
    expect(pathOf(last())).toBe('/api/attachments/f%201/file');
  });
});

describe('attachmentFileUrl', () => {
  it('returns the absolute file URL, for agents that download it themselves', () => {
    expect(setup().client.attachmentFileUrl('f 1')).toBe(
      'http://tracker.test/api/attachments/f%201/file',
    );
  });
});

describe('errors', () => {
  it('throws an ApiError with the status, code and message of the error body', async () => {
    const { client } = setup(() =>
      json({ error: { code: 'not_found', message: 'No ticket MOB-9.' } }, 404),
    );

    const error = await client.getTicket('MOB-9').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
      message: 'No ticket MOB-9.',
    });
  });

  it('throws an ApiError coded http_error with the status text for a non-JSON body', async () => {
    const { client } = setup(
      () => new Response('Internal Server Error', { status: 500, statusText: 'Server Error' }),
    );

    await expect(client.listProjects()).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      code: 'http_error',
      message: 'Server Error',
    });
  });

  it('throws an ApiError coded http_error for an empty error body', async () => {
    const { client } = setup(() => new Response(null, { status: 503, statusText: 'Unavailable' }));

    await expect(client.claimNext('MOB')).rejects.toMatchObject({
      status: 503,
      code: 'http_error',
      message: 'Unavailable',
    });
  });

  it('throws an ApiError when fetching a missing attachment file', async () => {
    const { client } = setup(() => json({ error: { code: 'not_found', message: 'Gone.' } }, 404));

    await expect(client.fetchAttachment('f1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
    });
    await expect(client.fetchAttachmentText('f1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    });
  });

  it('lets network failures reject unchanged', async () => {
    const failure = new TypeError('fetch failed');
    const client = new TrackerClient({ baseUrl: BASE, fetch: () => Promise.reject(failure) });

    await expect(client.listProjects()).rejects.toBe(failure);
  });
});

describe('eventsUrl', () => {
  it('returns the absolute events URL', () => {
    expect(setup().client.eventsUrl()).toBe('http://tracker.test/api/events');
  });

  it('returns a relative events URL for an empty base URL', () => {
    expect(new TrackerClient({ baseUrl: '' }).eventsUrl()).toBe('/api/events');
  });
});

describe('default fetch', () => {
  it('uses the global fetch when none is given', async () => {
    const globalFetch = vi.fn(() => Promise.resolve(json([])));
    vi.stubGlobal('fetch', globalFetch);
    const client = new TrackerClient({ baseUrl: BASE });

    await client.listProjects();

    expect(globalFetch).toHaveBeenCalledWith('http://tracker.test/api/projects', expect.anything());
  });
});
