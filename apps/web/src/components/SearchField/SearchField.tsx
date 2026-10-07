import clsx from 'clsx';
import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../Icon';
import styles from './SearchField.module.css';

export interface SearchFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'aria-label'> {
  'aria-label': string;
}

export function SearchField({ className, ...rest }: SearchFieldProps) {
  return (
    <label className={clsx(styles.field, className)}>
      <Icon icon={Search} />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className={styles.input}
        {...rest}
      />
    </label>
  );
}
