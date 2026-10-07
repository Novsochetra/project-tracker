import { avatarColor, initials } from '@tracker/shared';
import clsx from 'clsx';
import { Terminal } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './Avatar.module.css';

export type AvatarSize = 24 | 20;

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  decorative?: boolean;
  className?: string | undefined;
}

export interface BadgeAvatarProps {
  size?: AvatarSize;
  className?: string | undefined;
}

const sizeClass = (size: AvatarSize) => (size === 20 ? styles.small : styles.medium);

export function Avatar({ name, size = 24, decorative = false, className }: AvatarProps) {
  const trimmed = name.trim();
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : trimmed || 'Unassigned'}
      aria-hidden={decorative || undefined}
      title={trimmed || undefined}
      className={clsx(styles.avatar, sizeClass(size), !trimmed && styles.empty, className)}
      style={trimmed ? { backgroundColor: avatarColor(trimmed) } : undefined}
    >
      {initials(trimmed)}
    </span>
  );
}

export function AgentAvatar({ size = 20, className }: BadgeAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx(styles.avatar, sizeClass(size), styles.agent, className)}
    >
      <Icon icon={Terminal} size={14} />
    </span>
  );
}

export function YouAvatar({ size = 20, className }: BadgeAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx(styles.avatar, sizeClass(size), styles.you, className)}
    >
      Y
    </span>
  );
}
