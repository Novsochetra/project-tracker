import { formatFullDate } from '@tracker/shared';
import { useEffect, useRef, useState } from 'react';
import type { ActivityItem } from './activityItems';
import { ActivityCard, ActorAvatar, CardImages, type RiseProps } from './ActivityCard';
import styles from './ActivityCard.module.css';
import { CommentEditor } from './CommentEditor';
import { ItemMenu } from './ItemMenu';
import { TimeAgo } from './TimeAgo';
import type { ActivityActions } from './useActivityActions';

export interface CommentCardProps {
  item: Extract<ActivityItem, { kind: 'comment' }>;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
}

type EditPhase = 'idle' | 'editing' | 'done';

export function CommentCard({ item, now, actions, rise }: CommentCardProps) {
  const [phase, setPhase] = useState<EditPhase>('idle');
  const editing = phase === 'editing';
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The editor had focus and is gone, so keyboard users continue from the options button.
  useEffect(() => {
    if (phase === 'done') triggerRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const save = (text: string) => {
    setPhase('done');
    if (text.trim() !== item.text) actions.editComment(item.id, text);
  };
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
      hidden={editing}
      triggerRef={triggerRef}
      onEdit={() => setPhase('editing')}
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
      {editing ? (
        <CommentEditor
          draftId={`comment-edit:${item.id}`}
          initial={item.text}
          onSave={save}
          onCancel={() => setPhase('done')}
        />
      ) : (
        item.text && <p className={styles.body}>{item.text}</p>
      )}
      <CardImages images={item.images} />
    </ActivityCard>
  );
}
