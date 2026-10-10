import type { RunQuestionOption } from '@tracker/shared';
import clsx from 'clsx';
import { useId, type MouseEvent } from 'react';
import { ChoiceMark } from './ChoiceMark';
import { choiceNames } from './choiceNames';
import { ChoiceText } from './ChoiceText';
import styles from './Requests.module.css';

export interface ChoiceButtonProps {
  option: RunQuestionOption;
  // One of several a person may pick is a toggle; a choice that answers at once is a plain button.
  toggle: boolean;
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
      {...choiceNames(option, id)}
      disabled={disabled}
      onClick={onClick}
    >
      {toggle && <ChoiceMark round={false} on={selected} />}
      <ChoiceText option={option} id={id} />
    </button>
  );
}
