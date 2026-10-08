import { AgentAvatar } from '../../../components';
import type { ActivityItem } from './activityItems';
import { ActivityCard, CardImages, type RiseProps } from './ActivityCard';
import styles from './ActivityCard.module.css';
import { ItemMenu } from './ItemMenu';
import { TimeAgo } from './TimeAgo';
import type { ActivityActions } from './useActivityActions';

export interface ReportCardProps {
  item: Extract<ActivityItem, { kind: 'report' }>;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
}

export function ReportCard({ item, now, actions, rise }: ReportCardProps) {
  return (
    <ActivityCard
      tone="report"
      avatar={<AgentAvatar />}
      title={item.title}
      meta={<TimeAgo at={item.at} now={now} />}
      menu={<ItemMenu noun="report" onDelete={() => actions.remove(item.id)} />}
      {...rise}
    >
      <p className={styles.reportBody}>{item.text}</p>
      <CardImages images={item.images} />
    </ActivityCard>
  );
}
