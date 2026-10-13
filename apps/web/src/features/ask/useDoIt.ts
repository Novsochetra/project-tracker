import type { Chat, Run, Runner } from '@tracker/shared';
import { errorMessage } from '../../api';
import { useAsk } from '../../api/hooks/chats';
import { useRunners } from '../../api/hooks/runs';
import { askInputOf } from './askOptions';
import { DO_IT_TEXT } from './doItCopy';
import { doItOptions, planHelper } from './planToDo';

export interface DoIt {
  // Undefined until the helpers are known, null while the plan's helper is offline.
  helper: Runner | null | undefined;
  go: (helper: Runner) => void;
  pending: boolean;
  error: string | null;
}

export function useDoIt(projectKey: string, chat: Chat, plan: Run): DoIt {
  const runners = useRunners();
  const ask = useAsk();
  const go = (helper: Runner) => {
    if (ask.isPending) return;
    const input = askInputOf(helper.id, DO_IT_TEXT, doItOptions(chat));
    ask.mutate({ chatId: chat.id, input });
  };
  return {
    helper: runners.data && planHelper(plan, runners.data, projectKey),
    go,
    pending: ask.isPending,
    error: ask.error ? errorMessage(ask.error) : null,
  };
}
