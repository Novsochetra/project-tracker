import { useEffect, useRef } from 'react';
import type { ActivityItem } from './activityItems';
import { ItemMenu } from './ItemMenu';
import type { ActivityActions } from './useActivityActions';
import type { CommentEdit } from './useCommentEdit';

export interface CommentMenuProps {
  item: Extract<ActivityItem, { kind: 'comment' }>;
  edit: CommentEdit;
  actions: ActivityActions;
}

const focusIsLost = () =>
  document.activeElement === null || document.activeElement === document.body;

export function CommentMenu({ item, edit, actions }: CommentMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The editor had focus and is gone, so keyboard users continue from the options button, also
  // when the card takes over from its stand-in as the edit closes. An edit that saves once the
  // user has moved on leaves their focus alone.
  useEffect(() => {
    if (edit.closed && focusIsLost()) triggerRef.current?.focus({ preventScroll: true });
  }, [edit.closed]);

  return (
    <ItemMenu
      noun="comment"
      hidden={edit.open}
      triggerRef={triggerRef}
      onEdit={edit.start}
      onDelete={() => actions.remove(item.id)}
    />
  );
}
