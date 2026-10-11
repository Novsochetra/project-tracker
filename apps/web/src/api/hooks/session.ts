import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import type { LoginInput, SessionState } from '@tracker/shared';
import { useApi } from '../context';
import { isUnauthorized } from '../errors';
import { queryKeys, rootOf } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';
import { SIGNED_OUT } from '../unauthorized';

async function readSession(client: TrackerClient): Promise<SessionState> {
  try {
    return await client.getSession();
  } catch (error) {
    if (isUnauthorized(error)) return SIGNED_OUT;
    throw error;
  }
}

export function useSession(): TrackerQuery<SessionState> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: () => readSession(client),
    staleTime: Infinity,
  });
}

// The session the gate loaded, without asking the server again. A new reader of a session that
// failed to load (offline) would fetch it again, and the gate blanks the app while it fetches.
export function useKnownSession(): SessionState | undefined {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: () => readSession(client),
    staleTime: Infinity,
    enabled: false,
  }).data;
}

export function applySignIn(
  client: TrackerClient,
  queryClient: QueryClient,
  session: SessionState,
) {
  queryClient.setQueryData(queryKeys.session(), session);
  // Read through the service worker so its saved answer, which still says signed out, is replaced
  // for offline starts. The answer itself is ignored: on a slow network it can be that saved copy.
  void client.getSession().catch(() => undefined);
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) => rootOf(queryKey) !== 'session',
  });
}

export function useLogin(): TrackerMutation<SessionState, LoginInput> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: LoginInput) =>
      client.login({ email: email.trim(), password }),
    onSuccess: (session) => applySignIn(client, queryClient, session),
  });
}

// Stores only a signed-out answer and never refetches the query: the session gate blanks the app
// while a session it could not load is fetching, and an unreachable server signs nobody out.
export async function recheckSession(
  client: TrackerClient,
  queryClient: QueryClient,
): Promise<void> {
  const session = await readSession(client).catch(() => null);
  if (session?.authRequired && !session.authenticated) {
    queryClient.setQueryData(queryKeys.session(), session);
  }
}

// The new session clears the service worker's caches and what the app holds (watchSignedOut).
function useSignOutWith(
  signOut: (client: TrackerClient) => Promise<SessionState>,
): TrackerMutation<SessionState, void> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => signOut(client),
    onSuccess: (session) => queryClient.setQueryData(queryKeys.session(), session),
  });
}

export const useLogout = () => useSignOutWith((client) => client.logout());

export const useSignOutEverywhere = () => useSignOutWith((client) => client.signOutEverywhere());
