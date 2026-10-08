import { findStatusByCategory, type Status, type TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { ErrorBoundary } from '../../../lib/ErrorBoundary';
import { useNow } from '../../../lib/useNow';
import { activityItems, type ActivityItem } from './activityItems';
import type { RiseProps } from './ActivityCard';
import styles from './ActivitySection.module.css';
import { CommentCard } from './CommentCard';
import { Composer } from './Composer';
import { EventLine } from './EventLine';
import { ReportCard } from './ReportCard';
import { ReviewCard } from './ReviewCard';
import { firstRise, nextRise, type RisePlan } from './risePlan';
import { UnshownItem } from './UnshownItem';
import { useActivityActions, type ActivityActions } from './useActivityActions';

export interface ActivitySectionProps {
  detail: TicketDetail;
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

export function ActivitySection({ detail, className }: ActivitySectionProps) {
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
            key={item.id}
            item={item}
            now={now}
            actions={actions}
            rise={riseProps(plan.delays.get(item.id))}
            approvedColor={approvedColor}
            statuses={detail.statuses}
          />
        ))}
        <Composer ticketKey={detail.ticket.key} />
      </div>
    </section>
  );
}

interface ActivityRowProps {
  item: ActivityItem;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
  approvedColor: string | undefined;
  statuses: readonly Status[];
}

// An item that fails to render stands in as its plain text with its menu, and the rest of the
// ticket stays usable.
function ActivityRow(props: ActivityRowProps) {
  const { item, actions } = props;
  return (
    <ErrorBoundary
      name={`Activity item ${item.id}`}
      fallback={<UnshownItem item={item} actions={actions} />}
    >
      <ActivityContent {...props} />
    </ErrorBoundary>
  );
}

function ActivityContent({ item, now, actions, rise, approvedColor, statuses }: ActivityRowProps) {
  switch (item.kind) {
    case 'event':
      return <EventLine item={item} now={now} rise={rise} />;
    case 'comment':
      return <CommentCard item={item} now={now} actions={actions} rise={rise} />;
    case 'report':
      return <ReportCard item={item} now={now} actions={actions} rise={rise} statuses={statuses} />;
    case 'review':
      return (
        <ReviewCard
          item={item}
          now={now}
          actions={actions}
          rise={rise}
          approvedColor={approvedColor}
        />
      );
  }
}
