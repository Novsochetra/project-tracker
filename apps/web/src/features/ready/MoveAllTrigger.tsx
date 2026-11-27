import clsx from 'clsx';
import { CheckCheck } from 'lucide-react';
import type { Ref } from 'react';
import { Icon } from '../../components';
import { moveAllLabel, type DoneBatch } from './doneBatch';
import styles from './MoveAllToDone.module.css';

export type MoveAllLook = 'text' | 'row' | 'icon';

export interface MoveAllTriggerProps {
  batch: DoneBatch;
  look: MoveAllLook;
  expanded: boolean;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement> | undefined;
  className?: string | undefined;
}

const LOOKS: Record<MoveAllLook, string | undefined> = {
  text: styles.button,
  row: clsx('ring-inside', styles.row),
  icon: styles.icon,
};

// The icon alone fits a board column's 260px header beside the + without a second line; the
// pointer's tooltip and the name say what it does.
export function MoveAllTrigger({
  batch,
  look,
  expanded,
  onClick,
  ref,
  className,
}: MoveAllTriggerProps) {
  const label = moveAllLabel(batch);
  const iconOnly = look === 'icon';

  return (
    <button
      ref={ref}
      type="button"
      className={clsx(LOOKS[look], className)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <Icon icon={CheckCheck} />
      {!iconOnly && label}
    </button>
  );
}
