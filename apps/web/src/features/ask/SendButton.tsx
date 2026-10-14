import type { Run } from '@tracker/shared';
import clsx from 'clsx';
import { ArrowUp, Square } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Button } from '../../components';
import styles from './ChatScreen.module.css';
import { SEND_LABEL, STOP_LABEL } from './copy';
import { useStopAsk } from './useStopAsk';

export interface SendButtonProps {
  stoppableRun: Run | null;
  // While Claude answers, a typed message is sent to wait for its turn, so Send shows for it.
  hasDraft: boolean;
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
export function SendButton({ stoppableRun, hasDraft, canSend, onSend }: SendButtonProps) {
  const { stop, stopping } = useStopAsk();
  const stops = stoppableRun !== null && !hasDraft;
  const action =
    stoppableRun && stops
      ? {
          icon: Square,
          label: STOP_LABEL,
          disabled: stopping,
          onClick: (event: MouseEvent<HTMLButtonElement>) => stop(event, stoppableRun),
        }
      : { icon: ArrowUp, label: SEND_LABEL, disabled: !canSend, onClick: onSend };
  return (
    <Button
      variant="primary"
      icon={action.icon}
      className={clsx(styles.send, stops && styles.stop)}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      <Labels shown={action.label} />
    </Button>
  );
}
