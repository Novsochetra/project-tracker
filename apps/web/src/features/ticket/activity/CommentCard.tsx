import { formatFullDate } from '@tracker/shared';
import type { ActivityItem } from './activityItems';
import { ActivityCard, ActorAvatar, CardAttachments, type RiseProps } from './ActivityCard';
import styles from './ActivityCard.module.css';
import { CommentEditor } from './CommentEditor';
import { CommentMenu } from './CommentMenu';
import { LinkedText } from './LinkedText';
import { TimeAgo } from './TimeAgo';
import type { ActivityActions } from './useActivityActions';
import type { CommentEdit } from './useCommentEdit';

export interface CommentCardProps {
  item: Extract<ActivityItem, { kind: 'comment' }>;
  edit: CommentEdit;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
}

export function CommentCard({ item, edit, now, actions, rise }: CommentCardProps) {
  const meta = (
    <>
      <TimeAgo at={item.at} now={now} />
      {item.editedAt !== null && (
        <span title={`Edited ${formatFullDate(item.editedAt)}`}> · edited</span>
      )}
    </>
  );
  return (
    <ActivityCard
      avatar={<ActorAvatar actor={item.actor} />}
      title={item.author}
      meta={meta}
      menu={!item.draft && <CommentMenu item={item} edit={edit} actions={actions} />}
      dimmed={item.draft}
      {...rise}
    >
      {edit.open ? (
        <CommentEditor edit={edit} />
      ) : (
        item.text && (
          <p className={styles.body}>
            <LinkedText text={item.text} />
          </p>
        )
      )}
      <CardAttachments attachments={item.attachments} />
    </ActivityCard>
  );
}
