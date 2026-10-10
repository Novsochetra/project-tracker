import type { RunQuestionOption } from '@tracker/shared';
import clsx from 'clsx';
import { useId } from 'react';
import { ChoiceMark } from './ChoiceMark';
import { choiceNames } from './choiceNames';
import { ChoiceText } from './ChoiceText';
import styles from './Requests.module.css';

export interface ChoiceRadioProps {
  option: RunQuestionOption;
  group: string;
  checked: boolean;
  disabled: boolean;
  onPick: () => void;
}

// A native radio, so a single choice reads as one of a set and arrow keys move within it.
export function ChoiceRadio({ option, group, checked, disabled, onPick }: ChoiceRadioProps) {
  const id = useId();
  return (
    <label className={clsx(styles.choice, 'press', checked && styles.selected)}>
      <input
        type="radio"
        className={styles.radio}
        name={group}
        checked={checked}
        disabled={disabled}
        onChange={onPick}
        {...choiceNames(option, id)}
      />
      <ChoiceMark round on={checked} />
      <ChoiceText option={option} id={id} />
    </label>
  );
}
