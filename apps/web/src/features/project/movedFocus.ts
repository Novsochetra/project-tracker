import { notifyManager } from '@tanstack/react-query';
import { focusBefore } from '../../lib/focusBefore';
import { requestHandleFocus } from './dnd/handleFocus';

// The group leaves with its tickets, and the button with focus in it. Focus goes to what comes
// before the group at once, then to the first ticket's handle once its row shows in Done, where a
// keyboard move would have left it; a filter that hides Done leaves it before the group. Let go
// after React Query's own updates of the settled move, as a move's Undo does (useMoveToast).
export function followMovedTickets(
  group: Element | null,
  ticketId: string | undefined,
  moving: Promise<unknown>,
): void {
  if (group) focusBefore(group);
  if (!ticketId) return;

  const release = requestHandleFocus(ticketId);
  const later = () => notifyManager.schedule(release);
  void moving.then(later, later);
}
