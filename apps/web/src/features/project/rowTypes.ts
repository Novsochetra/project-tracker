import type { Status, TicketListItem } from '@tracker/shared';
import type { HandleKeyDown } from './dnd/useKeyboardMove';
import type { StartDrag } from './dnd/useTicketDrag';

/** What a board card can ask the board to do. */
export interface CardCallbacks {
  open: (ticket: TicketListItem) => void;
  startDrag: StartDrag;
  handleKeyDown: HandleKeyDown;
}

/** What a ticket row can ask the list to do. */
export interface RowCallbacks extends CardCallbacks {
  advance: (ticket: TicketListItem, status: Status) => void;
  chooseStatus: (ticket: TicketListItem) => void;
  confirmDelete: (ticket: TicketListItem) => void;
}
