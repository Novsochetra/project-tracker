import type { TicketListItem } from '@tracker/shared';
import { useMemo } from 'react';
import { useNavigation } from '../../navigation';
import { consumeClickGuard } from './dnd/clickGuard';
import type { HandleKeyDown } from './dnd/useKeyboardMove';
import type { StartDrag } from './dnd/useTicketDrag';
import { useStatusChange } from './rowEdits';
import type { RowCallbacks } from './rowTypes';
import type { RowSheetKind } from './useRowSheet';

export interface RowCallbackInput {
  projectKey: string;
  startDrag: StartDrag;
  handleKeyDown: HandleKeyDown;
  showSheet: (kind: RowSheetKind, ticket: TicketListItem) => void;
}

export function useRowCallbacks({
  projectKey,
  startDrag,
  handleKeyDown,
  showSheet,
}: RowCallbackInput): RowCallbacks {
  const { push } = useNavigation();
  const changeStatus = useStatusChange();
  return useMemo<RowCallbacks>(
    () => ({
      open: (ticket) => {
        if (consumeClickGuard()) return;
        push({ name: 'ticket', key: projectKey, num: ticket.num });
      },
      startDrag,
      handleKeyDown,
      advance: changeStatus,
      chooseStatus: (ticket) => showSheet('status', ticket),
      confirmDelete: (ticket) => showSheet('delete', ticket),
    }),
    [push, projectKey, startDrag, handleKeyDown, changeStatus, showSheet],
  );
}
