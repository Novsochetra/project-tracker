import type { Status } from '@tracker/shared';
import { AgentAvatar } from '../../../components';
import type { ActivityItem } from './activityItems';
import { ActivityCard, CardAttachments, type RiseProps } from './ActivityCard';
import { ItemMenu } from './ItemMenu';
import { ReportBody } from './ReportBody';
import { TimeAgo } from './TimeAgo';
import type { ActivityActions } from './useActivityActions';

export interface ReportCardProps {
  item: Extract<ActivityItem, { kind: 'report' }>;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
  statuses: readonly Status[];
}

export function ReportCard({ item, now, actions, rise, statuses }: ReportCardProps) {
  return (
    <ActivityCard
      tone="report"
      avatar={<AgentAvatar />}
      title={item.title}
      meta={<TimeAgo at={item.at} now={now} />}
      menu={<ItemMenu noun="report" onDelete={() => actions.remove(item.id)} />}
      {...rise}
    >
      <ReportBody text={item.text} statuses={statuses} />
      <CardAttachments attachments={item.attachments} />
    </ActivityCard>
  );
}
