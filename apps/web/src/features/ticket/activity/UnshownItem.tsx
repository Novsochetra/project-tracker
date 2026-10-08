import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '../../../components';
import type { ActivityItem } from './activityItems';
import { ActivityCard, ActorAvatar } from './ActivityCard';
import cardStyles from './ActivityCard.module.css';
import { CommentEditor } from './CommentEditor';
import { CommentMenu } from './CommentMenu';
import { ItemMenu } from './ItemMenu';
import styles from './UnshownItem.module.css';
import type { ActivityActions } from './useActivityActions';
import type { CommentEdit } from './useCommentEdit';

type CommentItem = Extract<ActivityItem, { kind: 'comment' }>;

export interface UnshownItemProps {
  item: Exclude<ActivityItem, CommentItem>;
  actions: ActivityActions;
  children?: ReactNode;
}

// The text as stored, through nothing that parses it, so it can't fail the way the card did.
const plainText = (item: ActivityItem): string => (typeof item.text === 'string' ? item.text : '');

export function UnshownItem({ item, actions, children }: UnshownItemProps) {
  const menu = (noun: string) => <ItemMenu noun={noun} onDelete={() => actions.remove(item.id)} />;
  switch (item.kind) {
    case 'event':
    case 'unknown':
      return <UnshownCard item={item} title={item.author} />;
    case 'report':
      return <UnshownCard item={item} title={item.title} tone="report" menu={menu('report')} />;
    case 'review':
      return (
        <UnshownCard item={item} title={`${item.author} reviewed`} menu={menu('review')}>
          {children}
        </UnshownCard>
      );
  }
}

export interface UnshownCommentProps {
  item: CommentItem;
  edit: CommentEdit;
  actions: ActivityActions;
}

export function UnshownComment({ item, edit, actions }: UnshownCommentProps) {
  return (
    <UnshownCard
      item={item}
      title={item.author}
      menu={!item.draft && <CommentMenu item={item} edit={edit} actions={actions} />}
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
  editor?: ReactNode;
  children?: ReactNode;
}

function UnshownCard({ item, title, tone, menu, dimmed, editor, children }: UnshownCardProps) {
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
      {children}
    </ActivityCard>
  );
}
