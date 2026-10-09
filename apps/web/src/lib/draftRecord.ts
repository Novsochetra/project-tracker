// comment-send: a comment on its way, kept until it lands; comment-back: one that came back to
// the comment box (activity/sentComments.ts).
export type DraftField =
  | 'title'
  | 'description'
  | 'assignee'
  | 'comment'
  | 'comment-edit'
  | 'comment-send'
  | 'comment-back';

export interface DraftTarget {
  ticketKey: string;
  field: DraftField;
  // The edited comment's id, or a comment send's own id.
  activityId?: string;
}

export interface StoredDraft extends DraftTarget {
  // The server value the text was typed over: a different one later means someone else
  // changed it meanwhile. For a comment on its way, how many of the ticket's comments had its
  // text when it was sent.
  base: string;
  text: string;
  // Save was pressed for this text. A comment edit is only ever sent for the user after that.
  submitted?: boolean;
  // The tracker refused this comment edit, as the comment changed elsewhere since it was typed:
  // it opens again saying so, also after a reload, until Save replaces theirs.
  changed?: boolean;
  // When the text was typed.
  at?: number;
}

// A draft's text as a tab kept it, under a key of that tab's own (lib/tabRecords.ts). A record
// is never changed: a tab puts a new one and removes those of the draft it has read, so a tab
// working from a copy of storage that hadn't heard of newer text can neither write older text
// over it nor drop it.
export interface DraftRecord extends StoredDraft {
  at: number;
}

export interface Held {
  key: string;
  record: DraftRecord;
}

const ofActivity = (field: DraftField): boolean =>
  field === 'comment-edit' || field === 'comment-send' || field === 'comment-back';

export const draftIdOf = ({ ticketKey, field, activityId }: DraftTarget): string =>
  ofActivity(field) ? `${field}:${activityId ?? ''}` : `${field}:${ticketKey}`;

const FIELDS: ReadonlySet<unknown> = new Set<DraftField>([
  'title',
  'description',
  'assignee',
  'comment',
  'comment-edit',
  'comment-send',
  'comment-back',
]);

const isText = (value: unknown): value is string => typeof value === 'string';
const isOptional = (value: unknown, type: 'boolean' | 'number'): boolean =>
  value === undefined || typeof value === type;

export function isStoredDraft(value: unknown): value is StoredDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    isText(draft.ticketKey) &&
    FIELDS.has(draft.field) &&
    isText(draft.base) &&
    isText(draft.text) &&
    (draft.activityId === undefined || isText(draft.activityId)) &&
    isOptional(draft.submitted, 'boolean') &&
    isOptional(draft.changed, 'boolean') &&
    isOptional(draft.at, 'number')
  );
}

export const isDraftRecord = (value: unknown): value is DraftRecord =>
  isStoredDraft(value) && typeof value.at === 'number';

// Text typed later wins; then any fixed order, so every tab picks the same record.
const isLater = (a: Held, b: Held): boolean =>
  a.record.at !== b.record.at ? a.record.at > b.record.at : a.key > b.key;

export const latestOf = (held: readonly Held[]): Held | undefined =>
  held.reduce<Held | undefined>(
    (latest, next) => (latest && isLater(latest, next) ? latest : next),
    undefined,
  );
