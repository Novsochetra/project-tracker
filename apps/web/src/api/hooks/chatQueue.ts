import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatDetail } from '@tracker/shared';
import { useApi } from '../context';
import type { TrackerMutation } from '../types';
import { refreshChat, showChat } from './chats';

export interface QueuedVariables {
  chatId: string;
  messageId: string;
}

export interface EditQueuedVariables extends QueuedVariables {
  text: string;
}

// A 409 means the message started or went elsewhere, which the chat should show now.
function useQueueMutation<V extends QueuedVariables>(
  call: (variables: V) => Promise<ChatDetail>,
): TrackerMutation<ChatDetail, V> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (detail) => showChat(queryClient, detail),
    onSettled: (_detail, _error, { chatId }) => refreshChat(queryClient, chatId),
  });
}

export function useEditQueued() {
  const client = useApi();
  return useQueueMutation(({ chatId, messageId, text }: EditQueuedVariables) =>
    client.editQueued(chatId, messageId, { text }),
  );
}

export function useRemoveQueued() {
  const client = useApi();
  return useQueueMutation(({ chatId, messageId }: QueuedVariables) =>
    client.removeQueued(chatId, messageId),
  );
}

export function useSendQueuedNow() {
  const client = useApi();
  return useQueueMutation(({ chatId, messageId }: QueuedVariables) =>
    client.sendQueuedNow(chatId, messageId),
  );
}
