import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangePasswordInput, ResetLinkCheck, ResetPasswordInput } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';

export function useChangePassword(): TrackerMutation<void, ChangePasswordInput> {
  const client = useApi();
  return useMutation({ mutationFn: (input: ChangePasswordInput) => client.changePassword(input) });
}

export function useCheckResetLink(secret: string): TrackerQuery<ResetLinkCheck> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.resetCheck(secret),
    queryFn: () => client.checkResetLink({ secret }),
    enabled: secret !== '',
    retry: false,
    // Each check counts toward the server's limit on reset link tries; one per page is enough.
    staleTime: Infinity,
  });
}

// The reset ends every session of that account, which may be this browser's.
export function useResetPassword(): TrackerMutation<void, ResetPasswordInput> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => client.resetPassword(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.session() }),
  });
}
