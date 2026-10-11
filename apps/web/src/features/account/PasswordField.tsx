import type { ComponentProps } from 'react';
import styles from './Password.module.css';

export interface PasswordFieldProps extends Omit<ComponentProps<'input'>, 'onChange' | 'type'> {
  label: string;
  onChange: (value: string) => void;
}

export function PasswordField({ label, onChange, ...input }: PasswordFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        type="password"
        className={styles.input}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...input}
      />
    </label>
  );
}
