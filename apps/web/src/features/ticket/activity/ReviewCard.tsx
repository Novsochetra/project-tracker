import type { ActivityItem } from './activityItems';
import { ActivityCard, ActorAvatar, CardAttachments, type RiseProps } from './ActivityCard';
import styles from './ActivityCard.module.css';
import { ItemMenu } from './ItemMenu';
import { LinkedText } from './LinkedText';
import { ReviewVerdict } from './ReviewVerdict';
import { TimeAgo } from './TimeAgo';
import type { ActivityActions } from './useActivityActions';

export interface ReviewCardProps {
  item: Extract<ActivityItem, { kind: 'review' }>;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
  // The project's Reviewed status color, so an approval looks like where it moved the ticket.
  approvedColor?: string | undefined;
}

export function ReviewCard({ item, now, actions, rise, approvedColor }: ReviewCardProps) {
  return (
    <ActivityCard
      avatar={<ActorAvatar actor={item.actor} />}
      title={`${item.author} reviewed`}
      meta={<TimeAgo at={item.at} now={now} />}
      menu={<ItemMenu noun="review" onDelete={() => actions.remove(item.id)} />}
      {...rise}
    >
      {item.review && <ReviewVerdict review={item.review} approvedColor={approvedColor} />}
      {item.text && (
        <p className={styles.body}>
          <LinkedText text={item.text} />
        </p>
      )}
      <CardAttachments attachments={item.attachments} />
    </ActivityCard>
  );
}
