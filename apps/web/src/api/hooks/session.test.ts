import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { errorMessage } from '../errors';
import { queryKeys } from '../queryKeys';
import { setupApi } from '../test/render';
import { useProjects } from './projects';
import { useLogin, useSession } from './session';
import { useDeleteTicket } from './tickets';

const unauthorized = () => new ApiError(401, 'unauthorized', 'Enter the access token.');
const signedOut = { authRequired: true, authenticated: false };
const signedIn = { authRequired: true, authenticated: true };

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

    act(() => result.current.login.mutate({ token: '  secret \n' }));

    await waitFor(() => expect(result.current.session.data).toEqual(signedIn));
    expect(login).toHaveBeenCalledWith('secret');
    await waitFor(() => expect(result.current.projects.data).toEqual([]));
  });

  it('reports a wrong token with the server message', async () => {
    const { wrapper } = setupApi({
      login: vi.fn().mockRejectedValue(new ApiError(401, 'unauthorized', 'That token is wrong.')),
    });
    const { result } = renderHook(() => useLogin(), { wrapper });
    act(() => result.current.mutate({ token: 'nope' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(errorMessage(result.current.error)).toBe('That token is wrong.');
  });
});
