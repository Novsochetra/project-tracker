import type { Run } from '@tracker/shared';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { useCancelAsk } from '../../api/hooks/chats';
import { useToast } from '../../components';
import { holdPresses } from '../../lib/holdPresses';

export function useStopAsk() {
  const cancel = useCancelAsk();
  const toast = useToast();
  // Send takes Stop's place once the question stops, and must not take the second tap of a double
  // tap: it would send the draft.
  const stop = (event: MouseEvent<HTMLButtonElement>, run: Run) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    cancel.mutate(run, {
      onError: (error) => toast.show(errorMessage(error), { kind: 'error' }),
    });
  };
  return { stop, stopping: cancel.isPending };
}
