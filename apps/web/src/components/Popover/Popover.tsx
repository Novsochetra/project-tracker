import clsx from 'clsx';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import styles from './Popover.module.css';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  'aria-label'?: string;
  className?: string | undefined;
}

export function Popover({
  open,
  onClose,
  trigger,
  children,
  'aria-label': label,
  className,
}: PopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  useCloseOnEscape(open, anchorRef, onClose);
  return (
    <div ref={anchorRef} className={clsx(styles.anchor, className)}>
      {trigger}
      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            className={styles.catch}
            onClick={onClose}
          />
          <div role="group" aria-label={label} className={styles.panel}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function useCloseOnEscape(
  open: boolean,
  anchorRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      const trigger = anchorRef.current?.firstElementChild;
      if (trigger instanceof HTMLElement) trigger.focus();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, anchorRef, onClose]);
}
