import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AcceptInviteInput, CreatedInvite, Invite, SessionState } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';
import { applySignIn } from './session';

export function useInvites(): TrackerQuery<Invite[]> {
  const client = useApi();
  return useQuery({ queryKey: queryKeys.invites(), queryFn: () => client.listInvites() });
}

function patchInvites(queryClient: QueryClient, change: (invites: Invite[]) => Invite[]): void {
  queryClient.setQueryData<Invite[]>(queryKeys.invites(), (invites) =>
    invites ? change(invites) : invites,
  );
  void queryClient.invalidateQueries({ queryKey: queryKeys.invites() });
}

// The secret is only in this answer, like a new token's; gcTime 0 drops it once nothing shows it.
export function useCreateInvite(): TrackerMutation<CreatedInvite, void> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.createInvite(),
    gcTime: 0,
    onSuccess: ({ invite }) => patchInvites(queryClient, (invites) => [...invites, invite]),
  });
}

export function useRevokeInvite(): TrackerMutation<void, string> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.revokeInvite(id),
    onSuccess: (_answer, id) =>
      patchInvites(queryClient, (invites) => invites.filter((invite) => invite.id !== id)),
  });
}

export function useCheckInvite(secret: string): TrackerQuery<{ expiresAt: number }> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.inviteCheck(secret),
    queryFn: () => client.checkInvite({ secret }),
    enabled: secret !== '',
    retry: false,
    // Each check counts toward the server's limit on invite tries; one per page is enough.
    staleTime: Infinity,
  });
}

export function useAcceptInvite(): TrackerMutation<SessionState, AcceptInviteInput> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AcceptInviteInput) => client.acceptInvite(input),
    onSuccess: (session) => applySignIn(client, queryClient, session),
  });
}
