import {
  ACTOR_KINDS,
  actorLabel,
  type Activity,
  type Actor,
  type Attachment,
  type Review,
} from '@tracker/shared';
import { isTemporaryId } from '../../../api';

interface ItemBase {
  id: string;
  actor: Actor | null;
  author: string;
  text: string;
  at: number;
  attachments: Attachment[];
  // The cache keeps an unchanged activity's object, so a new one here means the item changed.
  source: Activity;
}

export type ActivityItem =
  | (ItemBase & { kind: 'event' })
  | (ItemBase & { kind: 'comment'; editedAt: number | null; draft: boolean })
  | (ItemBase & { kind: 'report'; title: string })
  | (ItemBase & { kind: 'review'; review: Review | null })
  | (ItemBase & { kind: 'unknown' });

export const reportTitle = (actor: Actor | null): string =>
  actor?.kind === 'agent' && actor.name ? `${actor.name} report` : 'Claude Code report';

const ACTOR_KIND_SET: ReadonlySet<unknown> = new Set(ACTOR_KINDS);

function isActor(actor: unknown): actor is Actor {
  if (typeof actor !== 'object' || actor === null) return false;
  const { kind, name } = actor as Record<string, unknown>;
  return ACTOR_KIND_SET.has(kind) && typeof name === 'string';
}

const isDraftId = (id: unknown): boolean => typeof id === 'string' && isTemporaryId(id);

// Items are built outside the cards' error boundaries, so one activity the tracker sent in a shape
// this app doesn't expect must not fail here: an actor it can't read is "Someone", and a type it
// doesn't know (from a newer tracker) shows as plain text.
function toItem(activity: Activity): ActivityItem {
  const actor = isActor(activity.actor) ? activity.actor : null;
  const base: ItemBase = {
    id: activity.id,
    actor,
    author: actor ? actorLabel(actor) : 'Someone',
    text: activity.text,
    at: activity.createdAt,
    attachments: activity.attachments,
    source: activity,
  };
  switch (activity.type) {
    case 'event':
      return { ...base, kind: 'event' };
    case 'comment':
      return { ...base, kind: 'comment', editedAt: activity.editedAt, draft: isDraftId(base.id) };
    case 'report':
      return { ...base, kind: 'report', title: reportTitle(actor) };
    case 'review':
      return { ...base, kind: 'review', review: activity.review };
    default:
      return { ...base, kind: 'unknown' };
  }
}

// Drafts carry the device's clock, so they go last whatever their time says.
const order = (activity: Activity): number =>
  isDraftId(activity.id) ? Number.POSITIVE_INFINITY : activity.createdAt;

// Like toItem, this runs outside the cards' boundaries: an entry that isn't an object, such as
// null, has nothing to show and is left out.
const readable = (activity: readonly Activity[]): Activity[] =>
  activity.filter((entry: unknown) => typeof entry === 'object' && entry !== null);

export const activityItems = (activity: readonly Activity[]): ActivityItem[] =>
  readable(activity)
    .sort((a, b) => order(a) - order(b))
    .map(toItem);

export function lastReportAt(activity: readonly Activity[]): number | null {
  const times = readable(activity)
    .filter((item) => item.type === 'report')
    .map((item) => item.createdAt);
  return times.length > 0 ? Math.max(...times) : null;
}

export const isDraftItem = (item: ActivityItem): boolean => item.kind === 'comment' && item.draft;
