import { useRef, useState } from 'react';
import { useCreateCardTicket } from '../../api/hooks/chats';
import { cardInput, type IndexedCard } from './cards';

export interface CreateAll {
  busy: boolean;
  error: unknown;
  run: (pending: readonly IndexedCard[]) => Promise<void>;
}

// One at a time and in order, so the tickets take their numbers in the cards' order. A failure
// stops the rest; the ones made stay linked, and the next tap makes only what is left.
export function useCreateAll(chatId: string, messageId: string): CreateAll {
  const create = useCreateCardTicket();
  const running = useRef(false);
  const [state, setState] = useState<{ busy: boolean; error: unknown }>({
    busy: false,
    error: null,
  });
  const run = async (pending: readonly IndexedCard[]) => {
    if (running.current) return;
    running.current = true;
    setState({ busy: true, error: null });
    try {
      for (const card of pending) {
        await create.mutateAsync({ chatId, messageId, input: cardInput(card) });
      }
      setState({ busy: false, error: null });
    } catch (error) {
      setState({ busy: false, error });
    } finally {
      running.current = false;
    }
  };
  return { ...state, run };
}
