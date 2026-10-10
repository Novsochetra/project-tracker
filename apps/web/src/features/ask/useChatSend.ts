import type { ChatDetail, Runner } from '@tracker/shared';
import { useAsk, useStartChat } from '../../api/hooks/chats';
import { useNavigation } from '../../navigation';
import { rememberHelper } from '../claude/lastHelper';

export interface ChatSend {
  send: (text: string, onSent: () => void) => void;
  sending: boolean;
  error: Error | null;
}

// The first question makes the chat, whose own address then takes the new chat's place.
export function useChatSend(projectKey: string, chatId: string | null, helper: Runner | null) {
  const start = useStartChat();
  const ask = useAsk();
  const { replace } = useNavigation();
  const sending = start.isPending || ask.isPending;
  const send = (text: string, onSent: () => void) => {
    if (!helper || sending) return;
    const input = { runnerId: helper.id, text };
    const onSuccess = (detail: ChatDetail) => {
      rememberHelper(helper.id);
      onSent();
      if (!chatId) replace({ name: 'chat', key: projectKey, chatId: detail.chat.id });
    };
    if (chatId) ask.mutate({ chatId, input }, { onSuccess });
    else start.mutate({ projectKey, input }, { onSuccess });
  };
  return { send, sending, error: start.error ?? ask.error } satisfies ChatSend;
}
