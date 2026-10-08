import type { Status, TicketListItem } from '@tracker/shared';
import type { HandleKeyDown } from './dnd/useKeyboardMove';
import type { StartDrag } from './dnd/useTicketDrag';

/** What a ticket row can ask the list to do. */
export interface RowCallbacks {
  open: (ticket: TicketListItem) => void;
  startDrag: StartDrag;
  handleKeyDown: HandleKeyDown;
  advance: (ticket: TicketListItem, status: Status) => void;
  chooseStatus: (ticket: TicketListItem) => void;
  confirmDelete: (ticket: TicketListItem) => void;
}
