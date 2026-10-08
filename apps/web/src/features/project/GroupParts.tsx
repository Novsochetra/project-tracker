import type { Status } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronDown, Plus } from 'lucide-react';
import { Icon, IconButton, StatusGlyph } from '../../components';
import styles from './TicketGroup.module.css';

export interface GroupHeaderProps {
  status: Status;
  count: number;
  tint: boolean;
  onAdd: () => void;
}

export function GroupHeader({ status, count, tint, onAdd }: GroupHeaderProps) {
  return (
    <div className={styles.header} data-tint={tint || undefined}>
      <StatusGlyph category={status.category} color={status.color} />
      <span className={styles.name}>{status.name}</span>
      <span className={styles.count}>{count}</span>
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
