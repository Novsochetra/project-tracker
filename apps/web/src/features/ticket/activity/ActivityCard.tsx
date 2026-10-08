import type { Actor, Attachment } from '@tracker/shared';
import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { AgentAvatar, Avatar, YouAvatar } from '../../../components';
import { ThumbnailGrid, useAttachmentViewer } from '../../attachments';
import styles from './ActivityCard.module.css';

export interface RiseProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

export interface ActivityCardProps extends RiseProps {
  avatar: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  menu?: ReactNode;
  tone?: 'plain' | 'report';
  dimmed?: boolean;
  children?: ReactNode;
}

export function ActivityCard({
  avatar,
  title,
  meta,
  menu,
  tone = 'plain',
  dimmed = false,
  children,
  className,
  style,
}: ActivityCardProps) {
  return (
    <article
      className={clsx(
        styles.card,
        tone === 'report' && styles.report,
        dimmed && styles.draft,
        className,
      )}
      style={style}
    >
      <div className={styles.header}>
        {avatar}
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>{meta}</span>
        {menu && <span className={styles.menu}>{menu}</span>}
      </div>
      {children}
    </article>
  );
}

export function ActorAvatar({ actor }: { actor: Actor }) {
  if (actor.kind === 'agent') return <AgentAvatar />;
  return actor.name ? <Avatar name={actor.name} size={20} decorative /> : <YouAvatar />;
}

export function CardAttachments({ attachments }: { attachments: Attachment[] }) {
  const viewer = useAttachmentViewer();
  if (attachments.length === 0) return null;
  return (
    <ThumbnailGrid
      attachments={attachments}
      onOpen={(index) => viewer.open(attachments, index)}
      className={styles.attachments}
    />
  );
}
