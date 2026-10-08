import { findStatusByCategory, type TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import { useMemo, useState, type Ref } from 'react';
import { useNow } from '../../../lib/useNow';
import { activityItems, type ActivityItem } from './activityItems';
import type { RiseProps } from './ActivityCard';
import { ActivityRow } from './ActivityRow';
import styles from './ActivitySection.module.css';
import { Composer } from './Composer';
import { firstRise, nextRise, type RisePlan } from './risePlan';
import { useActivityActions } from './useActivityActions';

export interface ActivitySectionProps {
  detail: TicketDetail;
  composerRef?: Ref<HTMLFormElement>;
  className?: string | undefined;
}

function useRisePlan(items: readonly ActivityItem[]): RisePlan {
  const [plan, setPlan] = useState(() => firstRise(items));
  const next = nextRise(plan, items);
  if (next !== plan) setPlan(next);
  return next;
}

const riseProps = (delay: number | null | undefined): RiseProps =>
  delay === null || delay === undefined
    ? {}
    : { className: styles.rise, style: { animationDelay: `${delay}ms` } };

export function ActivitySection({ detail, composerRef, className }: ActivitySectionProps) {
  const items = useMemo(() => activityItems(detail.activity), [detail.activity]);
  const plan = useRisePlan(items);
  const now = useNow();
  const actions = useActivityActions(detail.ticket.key);
  const approvedColor = findStatusByCategory(detail.statuses, 'reviewed')?.color;
  return (
    <section aria-label="Activity" className={clsx(styles.section, className)}>
      <div className={styles.inner}>
        <h2 className={styles.heading}>Activity</h2>
        {items.map((item) => (
          <ActivityRow
            key={item.key}
            item={item}
            now={now}
            actions={actions}
            rise={riseProps(plan.delays.get(item.key))}
            approvedColor={approvedColor}
            statuses={detail.statuses}
          />
        ))}
        <Composer ticketKey={detail.ticket.key} ref={composerRef} />
      </div>
    </section>
  );
}
