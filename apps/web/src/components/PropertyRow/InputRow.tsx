import clsx from 'clsx';
import { useId, type ComponentProps, type ReactNode } from 'react';
import styles from './PropertyRow.module.css';

export interface InputRowProps extends Omit<ComponentProps<'input'>, 'list'> {
  icon: ReactNode;
  label: string;
  suggestions?: readonly string[] | undefined;
  mono?: boolean;
}

export function InputRow({
  icon,
  label,
  suggestions,
  mono = false,
  className,
  'aria-label': ariaLabel,
  ...rest
}: InputRowProps) {
  const listId = useId();
  return (
    <label className={clsx('ring-inside', styles.row, styles.field, className)}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={clsx(styles.input, mono && styles.mono)}
        aria-label={ariaLabel ?? label}
        list={suggestions ? listId : undefined}
        {...rest}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </label>
  );
}
