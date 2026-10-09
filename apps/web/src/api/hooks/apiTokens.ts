import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApiToken, CreateApiTokenInput, CreatedApiToken } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';

export function useApiTokens(): TrackerQuery<ApiToken[]> {
  const client = useApi();
  return useQuery({ queryKey: queryKeys.apiTokens(), queryFn: () => client.listApiTokens() });
}

function patchTokens(queryClient: QueryClient, change: (tokens: ApiToken[]) => ApiToken[]): void {
  queryClient.setQueryData<ApiToken[]>(queryKeys.apiTokens(), (tokens) =>
    tokens ? change(tokens) : tokens,
  );
  void queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens() });
}

// The secret is only in this answer; the list never holds it. With no gcTime the answer leaves the
// mutation cache as soon as nothing shows it: after reset() or once the sheet closes.
export function useCreateApiToken(): TrackerMutation<CreatedApiToken, CreateApiTokenInput> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiTokenInput) => client.createApiToken(input),
    gcTime: 0,
    onSuccess: ({ token }) =>
      patchTokens(queryClient, (tokens) => [...tokens.filter(({ id }) => id !== token.id), token]),
  });
}

export function useRevokeApiToken(): TrackerMutation<void, string> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.revokeApiToken(id),
    onSuccess: (_answer, id) =>
      patchTokens(queryClient, (tokens) => tokens.filter((token) => token.id !== id)),
  });
}
