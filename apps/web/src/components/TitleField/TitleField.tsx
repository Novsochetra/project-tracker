import clsx from 'clsx';
import type { KeyboardEvent } from 'react';
import { AutoTextarea, type AutoTextareaProps } from '../AutoTextarea';
import { keepOneLine } from './oneLine';
import styles from './TitleField.module.css';

export interface TitleFieldProps extends Omit<
  AutoTextareaProps,
  'value' | 'onChange' | 'onKeyDown' | 'rows' | 'variant'
> {
  value: string;
  onChange: (value: string) => void;
  // Enter submits, as it did when titles were one-line inputs.
  onEnter: () => void;
}

// A sheet's title wraps so a long one stays readable while typing, but it is still one line of
// text: Enter submits and line breaks become spaces.
export function TitleField({ value, onChange, onEnter, className, ...rest }: TitleFieldProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while composing (CJK input) confirms the composition instead.
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <AutoTextarea
      enterKeyHint="done"
      {...rest}
      className={clsx(styles.title, className)}
      value={value}
      onChange={(event) => onChange(keepOneLine(event.currentTarget))}
      onKeyDown={onKeyDown}
    />
  );
}
