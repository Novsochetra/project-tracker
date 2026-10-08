import type { Status, TicketListItem } from '@tracker/shared';
import { ArrowRight, CircleDot, Trash2 } from 'lucide-react';
import { Icon } from '../../components';
import type { SwipeAction } from '../../gestures';
import type { RowCallbacks } from './rowTypes';

export interface RowSwipeActions {
  leading: SwipeAction[];
  trailing: SwipeAction[];
}

/** Swipe right moves to the next status; swipe left reveals Status and Delete. */
export function rowSwipeActions(
  ticket: TicketListItem,
  next: Status | null,
  callbacks: RowCallbacks,
): RowSwipeActions {
  const leading: SwipeAction[] = next
    ? [
        {
          label: next.name,
          icon: <Icon icon={ArrowRight} size={20} />,
          tone: 'accent',
          onTrigger: () => callbacks.advance(ticket, next),
        },
      ]
    : [];
  const trailing: SwipeAction[] = [
    {
      label: 'Status',
      icon: <Icon icon={CircleDot} size={20} />,
      tone: 'neutral',
      onTrigger: () => callbacks.chooseStatus(ticket),
    },
    {
      label: 'Delete',
      icon: <Icon icon={Trash2} size={20} />,
      tone: 'danger',
      onTrigger: () => callbacks.confirmDelete(ticket),
    },
  ];
  return { leading, trailing };
}
