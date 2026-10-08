import { CircleAlert } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../../components';
import type { ActivityItem } from './activityItems';
import { ActivityCard, ActorAvatar } from './ActivityCard';
import cardStyles from './ActivityCard.module.css';
import { CommentEditor } from './CommentEditor';
import { ItemMenu } from './ItemMenu';
import styles from './UnshownItem.module.css';
import type { ActivityActions } from './useActivityActions';
import { useCommentEdit } from './useCommentEdit';

export interface UnshownItemProps {
  item: ActivityItem;
  actions: ActivityActions;
}

// The text as stored, through nothing that parses it, so it can't fail the way the card did.
const plainText = (item: ActivityItem): string => (typeof item.text === 'string' ? item.text : '');

/** Stands in for an activity card that failed to render, keeping its menu. */
export function UnshownItem({ item, actions }: UnshownItemProps) {
  const remove = () => actions.remove(item.id);
  switch (item.kind) {
    case 'event':
      return <UnshownCard item={item} title={item.author} />;
    case 'comment':
      return <UnshownComment item={item} actions={actions} />;
    case 'report':
      return (
        <UnshownCard
          item={item}
          title={item.title}
          tone="report"
          menu={<ItemMenu noun="report" onDelete={remove} />}
        />
      );
    case 'review':
      return (
        <UnshownCard
          item={item}
          title={`${item.author} reviewed`}
          menu={<ItemMenu noun="review" onDelete={remove} />}
        />
      );
  }
}

const focusIsLost = () =>
  document.activeElement === null || document.activeElement === document.body;

interface UnshownCommentProps {
  item: Extract<ActivityItem, { kind: 'comment' }>;
  actions: ActivityActions;
}

function UnshownComment({ item, actions }: UnshownCommentProps) {
  const edit = useCommentEdit(item, actions.editComment, actions.ticketKey);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // As on a comment card: keyboard users continue from the options button once the editor goes.
  useEffect(() => {
    if (edit.closed && focusIsLost()) triggerRef.current?.focus({ preventScroll: true });
  }, [edit.closed]);
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
    <UnshownCard
      item={item}
      title={item.author}
      menu={menu}
      dimmed={item.draft}
      editor={edit.open ? <CommentEditor edit={edit} /> : null}
    />
  );
}

interface UnshownCardProps {
  item: ActivityItem;
  title: string;
  tone?: 'plain' | 'report';
  menu?: ReactNode;
  dimmed?: boolean;
  /** Takes the place of the text while the item is being edited. */
  editor?: ReactNode;
}

function UnshownCard({ item, title, tone, menu, dimmed, editor }: UnshownCardProps) {
  const text = plainText(item);
  return (
    <ActivityCard
      avatar={<ActorAvatar actor={item.actor} />}
      title={title}
      meta={null}
      menu={menu}
      tone={tone}
      dimmed={dimmed}
    >
      <p className={styles.notice}>
        <Icon icon={CircleAlert} size={14} />
        Couldn't show this item
      </p>
      {editor ?? (text && <p className={cardStyles.body}>{text}</p>)}
    </ActivityCard>
  );
}
