import type { RunQuestionOption } from '@tracker/shared';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useId, type MouseEvent } from 'react';
import { Icon } from '../../components';
import styles from './Requests.module.css';

export interface ChoiceButtonProps {
  option: RunQuestionOption;
  // A choice that answers at once is a plain button; one of several to pick is a toggle.
  toggle: 'one' | 'many' | null;
  selected: boolean;
  disabled: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function ChoiceButton({ option, toggle, selected, disabled, onClick }: ChoiceButtonProps) {
  const id = useId();
  return (
    <button
      type="button"
      className={clsx(styles.choice, 'press', selected && styles.selected)}
      aria-pressed={toggle ? selected : undefined}
      // Named by the choice alone; its description is read after it.
      aria-labelledby={`${id}-label`}
      aria-describedby={option.description ? `${id}-description` : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {toggle && (
        <span className={clsx(styles.mark, toggle === 'one' && styles.round)} aria-hidden="true">
          {selected && <Icon icon={Check} size={14} />}
        </span>
      )}
      <span className={styles.choiceText}>
        <span id={`${id}-label`} className={styles.choiceLabel}>
          {option.label}
        </span>
        {option.description && (
          <span id={`${id}-description`} className={styles.choiceDescription}>
            {option.description}
          </span>
        )}
      </span>
    </button>
  );
}
