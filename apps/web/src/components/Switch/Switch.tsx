import clsx from 'clsx';
import type { ComponentProps } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<
  ComponentProps<'button'>,
  'onChange' | 'onClick' | 'role' | 'aria-label' | 'aria-checked' | 'children'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label': string;
}

export function Switch({ checked, onChange, className, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      {...rest}
      role="switch"
      aria-checked={checked}
      className={clsx(styles.track, className)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} aria-hidden="true" />
    </button>
  );
}
