import { formatFullDate } from '@tracker/shared';
import { useEffect, useRef } from 'react';
import type { ActivityItem } from './activityItems';
import { ActivityCard, ActorAvatar, CardImages, type RiseProps } from './ActivityCard';
import styles from './ActivityCard.module.css';
import { CommentEditor } from './CommentEditor';
import { ItemMenu } from './ItemMenu';
import { TimeAgo } from './TimeAgo';
import type { ActivityActions } from './useActivityActions';
import { useCommentEdit } from './useCommentEdit';

export interface CommentCardProps {
  item: Extract<ActivityItem, { kind: 'comment' }>;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
}

const focusIsLost = () =>
  document.activeElement === null || document.activeElement === document.body;

export function CommentCard({ item, now, actions, rise }: CommentCardProps) {
  const edit = useCommentEdit(item, actions.editComment);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The editor had focus and is gone, so keyboard users continue from the options button. An
  // edit that saves once the user has moved on leaves their focus alone.
  useEffect(() => {
    if (edit.closed && focusIsLost()) triggerRef.current?.focus({ preventScroll: true });
  }, [edit.closed]);

  const meta = (
    <>
      <TimeAgo at={item.at} now={now} />
      {item.editedAt !== null && (
        <span title={`Edited ${formatFullDate(item.editedAt)}`}> · edited</span>
      )}
    </>
  );
  const menu = !item.draft && (
    <ItemMenu
      noun="comment"
      hidden={edit.open}
      triggerRef={triggerRef}
      onEdit={edit.start}
      onDelete={() => actions.remove(item.id)}
    />
  );
  return (
    <ActivityCard
      avatar={<ActorAvatar actor={item.actor} />}
      title={item.author}
      meta={meta}
      menu={menu}
      dimmed={item.draft}
      {...rise}
    >
      {edit.open ? (
        <CommentEditor edit={edit} />
      ) : (
        item.text && <p className={styles.body}>{item.text}</p>
      )}
      <CardImages images={item.images} />
    </ActivityCard>
  );
}
