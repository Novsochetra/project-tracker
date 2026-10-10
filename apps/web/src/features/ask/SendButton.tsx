import type { Run } from '@tracker/shared';
import clsx from 'clsx';
import { ArrowUp, Square } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Button } from '../../components';
import styles from './ChatScreen.module.css';
import { SEND_LABEL, STOP_LABEL } from './copy';
import { useStopAsk } from './useStopAsk';

export interface SendButtonProps {
  // The chat's queued or running question, which this button then stops.
  working: Run | null;
  canSend: boolean;
  onSend: (event: MouseEvent<HTMLButtonElement>) => void;
}

// Both labels share one grid cell, so Stop is exactly Send's size whatever the font.
function Labels({ shown }: { shown: string }) {
  return (
    <span className={styles.labels}>
      {[SEND_LABEL, STOP_LABEL].map((label) => (
        <span key={label} aria-hidden={label !== shown}>
          {label}
        </span>
      ))}
    </span>
  );
}

// One button that turns between Send and Stop, so it stays the same element and keeps focus.
export function SendButton({ working, canSend, onSend }: SendButtonProps) {
  const { stop, stopping } = useStopAsk();
  const action = working
    ? {
        icon: Square,
        label: STOP_LABEL,
        disabled: stopping,
        onClick: (event: MouseEvent<HTMLButtonElement>) => stop(event, working),
      }
    : { icon: ArrowUp, label: SEND_LABEL, disabled: !canSend, onClick: onSend };
  return (
    <Button
      variant="primary"
      icon={action.icon}
      className={clsx(styles.send, working && styles.stop)}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      <Labels shown={action.label} />
    </Button>
  );
}
