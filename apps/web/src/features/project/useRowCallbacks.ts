import type { TicketListItem } from '@tracker/shared';
import { useCallback, useMemo } from 'react';
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

/** Opens a ticket from its row or card, except for the click that ends a drag. */
export function useOpenTicket(projectKey: string): (ticket: TicketListItem) => void {
  const { push } = useNavigation();
  return useCallback(
    (ticket: TicketListItem) => {
      if (consumeClickGuard()) return;
      push({ name: 'ticket', key: projectKey, num: ticket.num });
    },
    [push, projectKey],
  );
}

export function useRowCallbacks({
  projectKey,
  startDrag,
  handleKeyDown,
  showSheet,
}: RowCallbackInput): RowCallbacks {
  const open = useOpenTicket(projectKey);
  const changeStatus = useStatusChange();
  return useMemo<RowCallbacks>(
    () => ({
      open,
      startDrag,
      handleKeyDown,
      advance: changeStatus,
      chooseStatus: (ticket) => showSheet('status', ticket),
      confirmDelete: (ticket) => showSheet('delete', ticket),
    }),
    [open, startDrag, handleKeyDown, changeStatus, showSheet],
  );
}
