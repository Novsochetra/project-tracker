import type { Status, TicketListItem } from '@tracker/shared';
import type { HandleKeyDown } from './dnd/useKeyboardMove';
import type { StartDrag } from './dnd/useTicketDrag';

export interface CardCallbacks {
  open: (ticket: TicketListItem) => void;
  startDrag: StartDrag;
  handleKeyDown: HandleKeyDown;
}

export interface RowCallbacks extends CardCallbacks {
  advance: (ticket: TicketListItem, status: Status) => void;
  chooseStatus: (ticket: TicketListItem) => void;
  confirmDelete: (ticket: TicketListItem) => void;
}
