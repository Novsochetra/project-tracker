import { errorMessage } from '../../api';
import { useDeleteChat } from '../../api/hooks/chats';
import { useToast } from '../../components';
import { useNavigation } from '../../navigation';
import { CHAT_DELETED } from './copy';

export interface ChatDelete {
  pending: boolean;
  error: string | null;
  deleteChat: (onDeleted: () => void) => void;
  reset: () => void;
}

// The open chat goes back to the list once it is gone; the list itself stays where it is.
export function useChatDelete(projectKey: string, chatId: string, leave = true): ChatDelete {
  const remove = useDeleteChat();
  const { back } = useNavigation();
  const toast = useToast();
  const deleteChat = (onDeleted: () => void) => {
    if (remove.isPending) return;
    remove.mutate(
      { projectKey, chatId },
      {
        onSuccess: () => {
          onDeleted();
          if (leave) back();
          toast.show(CHAT_DELETED);
        },
      },
    );
  };
  return {
    pending: remove.isPending,
    error: remove.error ? errorMessage(remove.error) : null,
    deleteChat,
    reset: remove.reset,
  };
}
