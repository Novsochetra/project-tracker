import type { TicketMoves } from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, useMoveToDone, useUndoMoveToDone } from '../../api';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { movedBackMessage, movedMessage, type DoneBatch } from './doneBatch';

// Last first: each write is newer than the one before it, and Ready for you lists the newest
// first, so its order comes back as it was.
const undoPlaces = (moves: TicketMoves) =>
  moves.moved.map(({ key, from }) => ({ key, ...from })).reverse();

// Waits for the move: one that failed is already back, and its answer says where each ticket was.
function usePutBack(): (request: Promise<TicketMoves>) => Promise<void> {
  const { mutateAsync } = useUndoMoveToDone();

  return useCallback(
    async (request) => {
      const moves = await request.catch(() => null);
      if (!moves || moves.moved.length === 0) return;

      const places = undoPlaces(moves);
      const ticketKeys = places.map(({ key }) => key);
      flashRows(ticketKeys);
      await mutateAsync({ ticketKeys, places });
    },
    [mutateAsync],
  );
}

export function useMoveAllToDone(): (batch: DoneBatch) => void {
  const { mutateAsync } = useMoveToDone();
  const putBack = usePutBack();
  const { show } = useToast();

  return useCallback(
    (batch) => {
      const failed = (error: unknown) => show(errorMessage(error), { kind: 'error' });
      const request = mutateAsync({ ticketKeys: batch.keys });
      void request.catch(failed);
      flashRows(batch.keys);

      const undo = () => {
        show(movedBackMessage(batch));
        void putBack(request).catch(failed);
      };

      show(movedMessage(batch), { undo });
    },
    [mutateAsync, putBack, show],
  );
}
