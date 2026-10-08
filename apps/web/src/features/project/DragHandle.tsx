import type { TicketListItem } from '@tracker/shared';
import { GripVertical } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { Icon } from '../../components';
import { wantsHandleFocus } from './dnd/handleFocus';
import styles from './TicketRow.module.css';

export interface DragHandleProps {
  ticket: TicketListItem;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

// Pull to refresh listens for touchstart above the list; dragging the handle down must not pull.
function useStopTouchStart(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    const stop = (event: TouchEvent) => event.stopPropagation();
    handle.addEventListener('touchstart', stop, { passive: true });
    return () => handle.removeEventListener('touchstart', stop);
  }, [ref]);
}

export function DragHandle({ ticket, onPointerDown, onKeyDown }: DragHandleProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useStopTouchStart(ref);
  // After a keyboard move React may remount or move this row, which drops focus; take it back.
  useLayoutEffect(() => {
    const handle = ref.current;
    if (handle && handle !== document.activeElement && wantsHandleFocus(ticket.id)) {
      handle.focus();
    }
  });
  return (
    <button
      ref={ref}
      type="button"
      className={styles.handle}
      data-no-swipe=""
      data-handle-for={ticket.id}
      aria-label={`Move ${ticket.key}. Drag, or use the arrow keys.`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <Icon icon={GripVertical} />
    </button>
  );
}
