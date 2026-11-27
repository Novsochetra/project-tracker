import { useQueryClient } from '@tanstack/react-query';
import type { TicketMoves } from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, useMoveToDone, useUndoMoveToDone } from '../../api';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { playSound } from '../../sound';
import { keepMovedRowFocus } from '../project/movedFocus';
import { movedBackMessage, movedMessage, type DoneBatch } from './doneBatch';

// Last first: each write is newer than the one before it, and Ready for you lists the newest
// first, so its order comes back as it was.
const undoPlaces = (moves: TicketMoves) =>
  moves.moved.map(({ key, from }) => ({ key, ...from })).reverse();

function usePutBack(): (moves: TicketMoves) => Promise<void> {
  const queryClient = useQueryClient();
  const { mutateAsync } = useUndoMoveToDone();
  const { show } = useToast();

  return useCallback(
    async (moves) => {
      const places = undoPlaces(moves);
      const ticketKeys = places.map(({ key }) => key);
      flashRows(ticketKeys);
      const putBack = mutateAsync({ ticketKeys, places });
      keepMovedRowFocus(queryClient, ticketKeys, putBack);
      show(movedBackMessage((await putBack).moved.length));
    },
    [queryClient, mutateAsync, show],
  );
}

// The toast waits for the answer, which says how many really moved and where each one was.
export function useMoveAllToDone(): (batch: DoneBatch) => Promise<unknown> {
  const { mutateAsync } = useMoveToDone();
  const putBack = usePutBack();
  const { show } = useToast();

  return useCallback(
    (batch) => {
      const failed = (error: unknown) => show(errorMessage(error), { kind: 'error' });
      flashRows(batch.keys);
      const request = mutateAsync({ ticketKeys: batch.keys });
      const moved = (moves: TicketMoves) => {
        const count = moves.moved.length;
        if (count > 0) playSound('done');
        const undo = () => void putBack(moves).catch(failed);
        show(movedMessage(count, batch.doneName), count > 0 ? { undo } : {});
      };

      void request.then(moved, failed);

      return request;
    },
    [mutateAsync, putBack, show],
  );
}
