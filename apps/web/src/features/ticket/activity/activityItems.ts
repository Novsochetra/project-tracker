import {
  actorLabel,
  type Activity,
  type Actor,
  type Attachment,
  type Review,
} from '@tracker/shared';
import { isTemporaryId } from '../../../api';

interface ItemBase {
  id: string;
  actor: Actor;
  author: string;
  text: string;
  at: number;
  images: Attachment[];
}

export type ActivityItem =
  | (ItemBase & { kind: 'event' })
  | (ItemBase & { kind: 'comment'; editedAt: number | null; draft: boolean })
  | (ItemBase & { kind: 'report'; title: string })
  | (ItemBase & { kind: 'review'; review: Review | null });

export const reportTitle = (actor: Actor): string =>
  actor.kind === 'agent' && actor.name ? `${actor.name} report` : 'Claude Code report';

function toItem(activity: Activity): ActivityItem {
  const base: ItemBase = {
    id: activity.id,
    actor: activity.actor,
    author: actorLabel(activity.actor),
    text: activity.text,
    at: activity.createdAt,
    images: activity.attachments,
  };
  switch (activity.type) {
    case 'event':
      return { ...base, kind: 'event' };
    case 'comment':
      return {
        ...base,
        kind: 'comment',
        editedAt: activity.editedAt,
        draft: isTemporaryId(activity.id),
      };
    case 'report':
      return { ...base, kind: 'report', title: reportTitle(activity.actor) };
    case 'review':
      return { ...base, kind: 'review', review: activity.review };
  }
}

// Drafts carry the device's clock, so they go last whatever their time says.
const order = (activity: Activity): number =>
  isTemporaryId(activity.id) ? Number.POSITIVE_INFINITY : activity.createdAt;

export const activityItems = (activity: readonly Activity[]): ActivityItem[] =>
  [...activity].sort((a, b) => order(a) - order(b)).map(toItem);

export function lastReportAt(activity: readonly Activity[]): number | null {
  const times = activity.filter((item) => item.type === 'report').map((item) => item.createdAt);
  return times.length > 0 ? Math.max(...times) : null;
}

export const isDraftItem = (item: ActivityItem): boolean => item.kind === 'comment' && item.draft;
