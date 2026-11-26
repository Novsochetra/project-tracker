import { replacedDescription } from '@tracker/shared';
import clsx from 'clsx';
import type { ActivityItem } from './activityItems';
import type { RiseProps } from './ActivityCard';
import styles from './ActivitySection.module.css';
import { OldText } from './OldText';
import { TimeAgo } from './TimeAgo';

export interface EventLineProps {
  item: Extract<ActivityItem, { kind: 'event' }>;
  now: number;
  rise: RiseProps;
}

export function EventLine({ item, now, rise }: EventLineProps) {
  const replaced = replacedDescription(item.text);

  return (
    <div className={clsx(styles.event, rise.className)} style={rise.style}>
      <span className={styles.dotSlot} aria-hidden="true">
        <span className={styles.dot} />
      </span>
      <span className={styles.eventText}>
        <span className={styles.actor}>{item.author}</span> {replaced?.sentence ?? item.text}{' '}
        <span className={styles.when}>
          · <TimeAgo at={item.at} now={now} />
        </span>
        {replaced && <OldText text={replaced.oldText} />}
      </span>
    </div>
  );
}
