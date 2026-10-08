import { useCallback, useRef, useState } from 'react';
import { useMarkSent } from '../../api';

export interface MarkSentOnce {
  sent: boolean;
  mark: (moveToInProgress: boolean) => void;
  error: Error | null;
}

// Copy and Share can both fire, and quickly twice; only the first one logs "sent the ticket".
export function useMarkSentOnce(ticketKey: string): MarkSentOnce {
  const { mutate, error } = useMarkSent();
  const sentRef = useRef(false);
  const [sent, setSent] = useState(false);
  const mark = useCallback(
    (moveToInProgress: boolean) => {
      if (sentRef.current) return;
      sentRef.current = true;
      setSent(true);
      mutate(
        { ticketKey, input: { moveToInProgress } },
        {
          onError: () => {
            sentRef.current = false;
            setSent(false);
          },
        },
      );
    },
    [mutate, ticketKey],
  );
  return { sent, mark, error };
}
