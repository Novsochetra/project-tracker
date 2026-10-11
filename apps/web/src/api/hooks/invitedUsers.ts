import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatedResetLink, InvitedUser } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';

export function useInvitedUsers(): TrackerQuery<InvitedUser[]> {
  const client = useApi();
  return useQuery({ queryKey: queryKeys.invitedUsers(), queryFn: () => client.listInvitedUsers() });
}

function useRefreshUsers() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.invitedUsers() });
}

// The secret is only in this answer, like a new invite's; gcTime 0 drops it once nothing shows it.
export function useMakeResetLink(): TrackerMutation<CreatedResetLink, string> {
  const client = useApi();
  const refresh = useRefreshUsers();
  return useMutation({
    mutationFn: (userId: string) => client.makeResetLink(userId),
    gcTime: 0,
    onSuccess: refresh,
  });
}

export function useCancelResetLink(): TrackerMutation<void, string> {
  const client = useApi();
  const refresh = useRefreshUsers();
  return useMutation({
    mutationFn: (userId: string) => client.cancelResetLink(userId),
    onSuccess: refresh,
  });
}
