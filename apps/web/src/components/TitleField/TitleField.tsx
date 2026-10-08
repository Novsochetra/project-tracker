import clsx from 'clsx';
import { useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { AutoTextarea, type AutoTextareaProps } from '../AutoTextarea';
import { useOneLineInserts } from './insertOnOneLine';
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

// Safari can end a composition before the keydown of the Enter that confirms it, which then
// only shows the input method's keyCode.
const IME_KEY_CODE = 229;

const confirmsComposition = (event: KeyboardEvent<HTMLTextAreaElement>): boolean =>
  event.nativeEvent.isComposing || event.keyCode === IME_KEY_CODE;

// A sheet's title wraps so a long one stays readable while typing, but it is still one line of
// text: Enter submits and line breaks become spaces.
export function TitleField({ value, onChange, onEnter, className, ref, ...rest }: TitleFieldProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => fieldRef.current as HTMLTextAreaElement, []);
  useOneLineInserts(fieldRef);
  // Before the sheet focuses the field, so typing goes on after a title kept from earlier.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    field?.setSelectionRange(field.value.length, field.value.length);
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || confirmsComposition(event)) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <AutoTextarea
      enterKeyHint="done"
      {...rest}
      ref={fieldRef}
      className={clsx(styles.title, className)}
      value={value}
      onChange={(event) => onChange(keepOneLine(event.currentTarget))}
      onKeyDown={onKeyDown}
    />
  );
}
