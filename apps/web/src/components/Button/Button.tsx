import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'header' | 'bar';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | undefined;
  tone?: 'default' | 'danger';
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  tone = 'default',
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        styles.button,
        styles[variant],
        styles[size],
        tone === 'danger' && styles.dangerTone,
        fullWidth && styles.fullWidth,
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} size={size === 'bar' ? 20 : 16} />}
      {children}
    </button>
  );
}
