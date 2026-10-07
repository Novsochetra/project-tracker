import clsx from 'clsx';
import { useImperativeHandle, useLayoutEffect, useRef, type ComponentProps } from 'react';
import styles from './AutoTextarea.module.css';

export interface AutoTextareaProps extends ComponentProps<'textarea'> {
  variant?: 'plain' | 'inline';
}

const supportsFieldSizing = (): boolean =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('field-sizing', 'content');

export function AutoTextarea({
  variant = 'plain',
  className,
  ref,
  value,
  onInput,
  rows = 1,
  ...rest
}: AutoTextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);
  useLayoutEffect(() => {
    if (innerRef.current) fitHeight(innerRef.current);
  }, [value]);
  return (
    <textarea
      ref={innerRef}
      rows={rows}
      value={value}
      className={clsx(styles.textarea, styles[variant], className)}
      onInput={(event) => {
        fitHeight(event.currentTarget);
        onInput?.(event);
      }}
      {...rest}
    />
  );
}

function fitHeight(textarea: HTMLTextAreaElement) {
  if (supportsFieldSizing()) return;
  textarea.style.height = 'auto';
  const borders = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${textarea.scrollHeight + borders}px`;
}
