import type { QueryClient } from '@tanstack/react-query';
import type { ChatDeletedEvent } from '@tracker/shared';
import type { DeleteChatVariables } from '../hooks/chats';
import { queryKeys } from '../queryKeys';
import { refreshLive } from './refreshLive';

const deletingHere = (queryClient: QueryClient, chatId: string): boolean =>
  queryClient.isMutating({
    mutationKey: queryKeys.deletingChat(),
    predicate: ({ state }) =>
      (state.variables as DeleteChatVariables | undefined)?.chatId === chatId,
  }) > 0;

// Reading the open chat again gets its 404, which takes the screen back to the list. The tab that
// deletes it goes back by itself, and a second leave would go back one screen too far.
export function refreshForChatDeleted(
  queryClient: QueryClient,
  { chatId }: ChatDeletedEvent,
): void {
  void refreshLive(queryClient, { queryKey: queryKeys.allChats() });
  if (deletingHere(queryClient, chatId)) return;
  void refreshLive(queryClient, { queryKey: queryKeys.chat(chatId), exact: true });
}
