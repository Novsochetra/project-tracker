import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import type { SessionState } from '@tracker/shared';
import { useApi } from '../context';
import { isUnauthorized } from '../errors';
import { queryKeys, rootOf } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';
import { SIGNED_OUT } from '../unauthorized';

export interface LoginVariables {
  token: string;
}

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

export function useLogin(): TrackerMutation<SessionState, LoginVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token }: LoginVariables) => client.login(token.trim()),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session(), session);
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) => rootOf(queryKey) !== 'session',
      });
    },
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
