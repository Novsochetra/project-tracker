import type { ComponentProps } from 'react';
import styles from './LoginScreen.module.css';

export interface AuthFieldProps extends Omit<ComponentProps<'input'>, 'onChange'> {
  label: string;
  onChange: (value: string) => void;
}

export function AuthField({ label, onChange, ...input }: AuthFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...input}
      />
    </label>
  );
}
