import type { Status } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Icon, IconButton, StatusGlyph } from '../../components';
import styles from './TicketGroup.module.css';

export interface GroupHeaderProps {
  status: Status;
  count: number;
  tint: boolean;
  onAdd: () => void;
  // Only while the group is expanded, so it can be collapsed without scrolling to its footer.
  onCollapse?: (() => void) | undefined;
  className?: string | undefined;
}

export function GroupHeader(props: GroupHeaderProps) {
  const { status, count, tint, onAdd, onCollapse, className } = props;
  return (
    <div className={clsx(styles.header, className)} data-tint={tint || undefined}>
      <StatusGlyph category={status.category} color={status.color} />
      <span className={styles.name}>{status.name}</span>{' '}
      <span className={styles.count}>{count}</span>
      {onCollapse && <HeaderShowLess name={status.name} onClick={onCollapse} />}
      <IconButton
        size="sm"
        icon={Plus}
        aria-label={`New ticket in ${status.name}`}
        className={styles.add}
        onClick={onAdd}
      />
    </div>
  );
}

export interface HeaderShowLessProps {
  name: string;
  onClick: () => void;
  className?: string | undefined;
}

export function HeaderShowLess({ name, onClick, className }: HeaderShowLessProps) {
  return (
    <button
      type="button"
      className={clsx(styles.less, className)}
      aria-expanded
      aria-label={`Show less of ${name}`}
      onClick={onClick}
    >
      Show less
      <Icon icon={ChevronUp} className={styles.chevron} />
    </button>
  );
}

export function DropZone({ name, targeted }: { name: string; targeted: boolean }) {
  return (
    <div className={styles.zoneWrap}>
      <div className={styles.zone} data-targeted={targeted || undefined}>
        Drop here to move to {name}
      </div>
    </div>
  );
}

export interface ShowMoreButtonProps {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}

export function ShowMoreButton({ expanded, hiddenCount, onToggle }: ShowMoreButtonProps) {
  return (
    <button
      type="button"
      className={clsx('ring-inside', styles.more)}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? 'Show less' : `Show ${hiddenCount} more`}
      <Icon icon={ChevronDown} className={styles.chevron} />
    </button>
  );
}
