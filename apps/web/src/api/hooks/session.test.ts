import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMessage } from '../errors';
import { queryKeys } from '../queryKeys';
import { setupApi } from '../test/render';
import { useProjects } from './projects';
import { recheckSession, useLogin, useLogout, useSession, useSignOutEverywhere } from './session';
import { useDeleteTicket } from './tickets';

const unauthorized = () => new ApiError(401, 'unauthorized', 'Enter the access token.');
const signedOut = { authRequired: true, authenticated: false };
const signedIn = { authRequired: true, authenticated: true };
const open = { authRequired: false, authenticated: true };
const owner = { authRequired: true, authenticated: true, email: 'owner@example.com' };

afterEach(() => {
  vi.unstubAllGlobals();
});

// Cache Storage as the service worker's caches live in it; jsdom has none.
function stubCaches() {
  const remove = vi.fn((_name: string) => Promise.resolve(true));
  const put = vi.fn((_request: Request, _response: Response) => Promise.resolve());
  vi.stubGlobal('caches', { delete: remove, open: () => Promise.resolve({ put }) });
  return Object.assign(remove, { put });
}

describe('useSession', () => {
  it('loads the auth state', async () => {
    const { wrapper } = setupApi({ getSession: vi.fn().mockResolvedValue(signedIn) });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(signedIn));
  });

  it('turns signed out when any query is refused', async () => {
    const { wrapper } = setupApi({
      getSession: vi.fn().mockResolvedValue(signedIn),
      listProjects: vi.fn().mockRejectedValue(unauthorized()),
    });
    const { result } = renderHook(() => ({ session: useSession(), projects: useProjects() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.projects.isError).toBe(true));
    await waitFor(() => expect(result.current.session.data).toEqual(signedOut));
  });

  it('turns signed out when a mutation is refused', async () => {
    const { queryClient, wrapper } = setupApi({
      deleteTicket: vi.fn().mockRejectedValue(unauthorized()),
    });
    const { result } = renderHook(() => useDeleteTicket(), { wrapper });
    act(() => result.current.mutate({ ticketKey: 'MOB-1' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(queryKeys.session())).toEqual(signedOut);
  });

  it('treats a refused session check as signed out', async () => {
    const { wrapper } = setupApi({ getSession: vi.fn().mockRejectedValue(unauthorized()) });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(signedOut));
  });
});

describe('useLogin', () => {
  it('stores the session and retries what failed before', async () => {
    const listProjects = vi.fn().mockRejectedValueOnce(unauthorized()).mockResolvedValue([]);
    const login = vi.fn().mockResolvedValue(signedIn);
    const { wrapper } = setupApi({
      getSession: vi.fn().mockResolvedValue(signedOut),
      listProjects,
      login,
    });
    const { result } = renderHook(
      () => ({ session: useSession(), projects: useProjects(), login: useLogin() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.projects.isError).toBe(true));

    act(() => result.current.login.mutate({ email: ' owner@example.com ', password: ' pass ' }));

    await waitFor(() => expect(result.current.session.data).toEqual(signedIn));
    expect(login).toHaveBeenCalledWith({ email: 'owner@example.com', password: ' pass ' });
    await waitFor(() => expect(result.current.projects.data).toEqual([]));
  });

  it('reports a wrong password with the server message', async () => {
    const wrong = new ApiError(401, 'unauthorized', 'Email or password is incorrect.');
    const { wrapper } = setupApi({ login: vi.fn().mockRejectedValue(wrong) });
    const { result } = renderHook(() => useLogin(), { wrapper });
    act(() => result.current.mutate({ email: 'owner@example.com', password: 'nope' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(errorMessage(result.current.error)).toBe('Email or password is incorrect.');
  });
});

describe('recheckSession', () => {
  async function recheck(getSession: () => Promise<unknown>) {
    const { client, queryClient } = setupApi({ getSession: vi.fn(getSession) });
    queryClient.setQueryData(queryKeys.session(), open);
    await recheckSession(client, queryClient);
    return queryClient.getQueryData(queryKeys.session());
  }

  it('signs out when the server now asks to sign in', async () => {
    expect(await recheck(() => Promise.resolve(signedOut))).toEqual(signedOut);
  });

  it('signs out when the session check itself is refused', async () => {
    expect(await recheck(() => Promise.reject(unauthorized()))).toEqual(signedOut);
  });

  it('keeps the app open when the server is unreachable or still lets the user in', async () => {
    expect(await recheck(() => Promise.reject(new TypeError('Failed to fetch')))).toEqual(open);
    const proxyAnswer = new ApiError(502, 'http_error', 'Bad Gateway');
    expect(await recheck(() => Promise.reject(proxyAnswer))).toEqual(open);
    expect(await recheck(() => Promise.resolve(signedIn))).toEqual(open);
  });

  it('never blanks the app by refetching a session it could not load', async () => {
    const getSession = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const { client, queryClient, wrapper } = setupApi({ getSession });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const fetchStatuses: string[] = [];
    const stop = queryClient.getQueryCache().subscribe(({ query }) => {
      fetchStatuses.push(query.state.fetchStatus);
    });

    await recheckSession(client, queryClient);

    stop();
    expect(fetchStatuses).not.toContain('fetching');
    expect(result.current.data).toBeUndefined();
  });
});

describe.each([
  ['useLogout', 'logout', useLogout],
  ['useSignOutEverywhere', 'signOutEverywhere', useSignOutEverywhere],
] as const)('%s', (_name, method, useSignOut) => {
  it('signs out, forgets what was read and empties the service worker caches', async () => {
    const removed = stubCaches();
    const getSession = vi.fn().mockResolvedValueOnce(owner).mockResolvedValue(signedOut);
    const signOut = vi.fn().mockResolvedValue(signedOut);
    const { queryClient, wrapper } = setupApi({ getSession, [method]: signOut });
    queryClient.setQueryData(queryKeys.projects(), []);
    const { result } = renderHook(() => ({ session: useSession(), signOut: useSignOut() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.session.data).toEqual(owner));

    act(() => result.current.signOut.mutate());

    await waitFor(() => expect(result.current.session.data).toEqual(signedOut));
    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(removed.mock.calls).toEqual([['api'], ['attachments']]));
    expect(queryClient.getQueryData(queryKeys.projects())).toBeUndefined();
    // The service worker's saved session now says signed out, for starts without the network.
    await waitFor(() => expect(removed.put).toHaveBeenCalledTimes(1));
    expect(await removed.put.mock.calls[0]![1].json()).toEqual(signedOut);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the session and the saved answers when the tracker cannot be reached', async () => {
    const removed = stubCaches();
    const { queryClient, wrapper } = setupApi({
      getSession: vi.fn().mockResolvedValue(owner),
      [method]: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });
    queryClient.setQueryData(queryKeys.projects(), []);
    const { result } = renderHook(() => ({ session: useSession(), signOut: useSignOut() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.session.data).toEqual(owner));

    act(() => result.current.signOut.mutate());

    await waitFor(() => expect(result.current.signOut.isError).toBe(true));
    expect(errorMessage(result.current.signOut.error)).toBe(
      "Can't reach the tracker. Check your connection.",
    );
    expect(result.current.session.data).toEqual(owner);
    expect(removed).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.projects())).toEqual([]);
  });
});

describe('signed out by the server', () => {
  it('forgets what was read once a request is refused', async () => {
    const removed = stubCaches();
    const { queryClient, wrapper } = setupApi({
      getSession: vi.fn().mockResolvedValue(owner),
      listProjects: vi.fn().mockRejectedValue(unauthorized()),
    });
    queryClient.setQueryData(queryKeys.ready(), { tickets: [], statuses: [] });
    const { result } = renderHook(() => ({ session: useSession(), projects: useProjects() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.session.data).toEqual(signedOut));
    await waitFor(() => expect(removed).toHaveBeenCalledWith('api'));
    expect(queryClient.getQueryData(queryKeys.ready())).toBeUndefined();
  });

  it('leaves an open tracker and a signed-in session alone', async () => {
    const removed = stubCaches();
    for (const session of [open, owner]) {
      const { wrapper } = setupApi({ getSession: vi.fn().mockResolvedValue(session) });
      const { result } = renderHook(() => useSession(), { wrapper });
      await waitFor(() => expect(result.current.data).toEqual(session));
    }
    expect(removed).not.toHaveBeenCalled();
  });
});
