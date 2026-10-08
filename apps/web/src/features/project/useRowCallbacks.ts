import { parseTicketKey, type TicketListItem } from '@tracker/shared';
import { useCallback, useMemo } from 'react';
import { useIsOpening, useNavigation } from '../../navigation';
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

// The screen opens a ticket under its project's key, which the ticket's own key starts with.
export function useIsOpeningTicket(ticket: TicketListItem): boolean {
  const projectKey = parseTicketKey(ticket.key)?.projectKey ?? '';
  return useIsOpening({ name: 'ticket', key: projectKey, num: ticket.num });
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
