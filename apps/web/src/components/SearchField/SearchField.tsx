import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import type { ComponentProps, MouseEvent } from 'react';
import { Icon } from '../Icon';
import styles from './SearchField.module.css';

export interface SearchFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'aria-label'> {
  'aria-label': string;
  // An iOS search field: filled gray, no border, a soft halo while focused.
  filled?: boolean;
  // Shows a clear button while there is text, as iOS's search fields do.
  onClear?: (() => void) | undefined;
}

// The field keeps focus, so typing goes on after a clear.
const keepFocus = (event: MouseEvent) => event.preventDefault();

export function SearchField({ className, filled = false, onClear, ...rest }: SearchFieldProps) {
  const hasText = typeof rest.value === 'string' && rest.value !== '';

  return (
    <label className={clsx(styles.field, filled && styles.filled, className)}>
      <Icon icon={Search} />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className={styles.input}
        {...rest}
      />
      {onClear && hasText && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear"
          className={styles.clear}
          onMouseDown={keepFocus}
          onClick={onClear}
        >
          <span className={styles.clearDisc}>
            <X size={10} strokeWidth={3} aria-hidden="true" focusable="false" />
          </span>
        </button>
      )}
    </label>
  );
}
