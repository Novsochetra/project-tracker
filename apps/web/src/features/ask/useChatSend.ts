import type { AskOptions, ChatDetail, Runner } from '@tracker/shared';
import { useAsk, useStartChat } from '../../api/hooks/chats';
import { useNavigation, useOptionalScreen } from '../../navigation';
import { rememberHelper } from '../claude/lastHelper';
import { askInputOf } from './askOptions';
import { chatRoute, startInputOf, ticketNumOf } from './ticketChat';

export interface ChatSend {
  send: (text: string, options: AskOptions, onSent: () => void) => void;
  sending: boolean;
  error: Error | null;
}

// The first question makes the chat, whose own address then takes the new chat's place.
export function useChatSend(projectKey: string, chatId: string | null, helper: Runner | null) {
  const start = useStartChat();
  const ask = useAsk();
  const { replace } = useNavigation();
  const ticketNum = ticketNumOf(useOptionalScreen()?.route);
  const sending = start.isPending || ask.isPending;
  const send = (text: string, options: AskOptions, onSent: () => void) => {
    if (!helper || sending) return;
    const input = askInputOf(helper.id, text, options);
    const onSuccess = (detail: ChatDetail) => {
      rememberHelper(helper.id);
      onSent();
      if (!chatId) replace(chatRoute(projectKey, detail.chat.id, ticketNum));
    };
    if (chatId) ask.mutate({ chatId, input }, { onSuccess });
    else
      start.mutate(
        { projectKey, input: startInputOf(input, projectKey, ticketNum) },
        { onSuccess },
      );
  };
  return { send, sending, error: start.error ?? ask.error } satisfies ChatSend;
}
