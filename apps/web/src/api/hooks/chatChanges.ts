import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatChangesAnswer, ChatCommitInput, ChatPullRequestInput } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';

// A commit takes seconds: the chat-git event tells sooner, this catches one that was missed.
const GIT_ACTION_REFRESH_MS = 5_000;

const going = (answer: ChatChangesAnswer | undefined): boolean =>
  answer?.action?.status === 'queued' || answer?.action?.status === 'running';

// Read again on the chat's run and chat-git events (api/live).
export function useChatChanges(chatId: string | null): TrackerQuery<ChatChangesAnswer> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.chatChanges(chatId ?? ''),
    queryFn: () => client.getChatChanges(chatId ?? ''),
    enabled: chatId !== null,
    refetchInterval: (query) => (going(query.state.data) ? GIT_ACTION_REFRESH_MS : false),
  });
}

function useGitMutation<T>(
  chatId: string,
  send: (input: T) => Promise<ChatChangesAnswer>,
): TrackerMutation<ChatChangesAnswer, T> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (answer) => queryClient.setQueryData(queryKeys.chatChanges(chatId), answer),
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.chatChanges(chatId) }),
  });
}

export function useCommitChat(chatId: string): TrackerMutation<ChatChangesAnswer, ChatCommitInput> {
  const client = useApi();
  return useGitMutation(chatId, (input: ChatCommitInput) => client.commitChat(chatId, input));
}

export function useOpenPullRequest(
  chatId: string,
): TrackerMutation<ChatChangesAnswer, ChatPullRequestInput> {
  const client = useApi();
  return useGitMutation(chatId, (input: ChatPullRequestInput) =>
    client.openChatPullRequest(chatId, input),
  );
}
