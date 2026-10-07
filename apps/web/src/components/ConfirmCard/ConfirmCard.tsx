import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../Button';
import styles from './ConfirmCard.module.css';

export interface ConfirmCardProps {
  message: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  pending?: boolean;
  variant?: 'card' | 'menu';
  className?: string | undefined;
}

export function ConfirmCard({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Delete',
  pending = false,
  variant = 'card',
  className,
}: ConfirmCardProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // The button that opened the confirm is gone, so focus moves to the safe choice.
  useEffect(() => cancelRef.current?.focus({ preventScroll: true }), []);
  const size = variant === 'menu' ? 'sm' : 'md';
  return (
    <div role="alert" className={clsx(styles.confirm, styles[variant], className)}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Button ref={cancelRef} size={size} className={styles.cancel} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" size={size} disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
