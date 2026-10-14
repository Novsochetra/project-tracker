import type { TicketDetail } from '@tracker/shared';
import { matchesActivity } from '../../../api';
import type { StoredDraft } from '../../../lib/storedDrafts';

export type DraftCheck = 'saved' | 'unchanged' | 'changed' | 'gone';

export function serverText(detail: TicketDetail, draft: StoredDraft): string | undefined {
  switch (draft.field) {
    case 'title':
      return detail.ticket.title;
    case 'description':
      return detail.ticket.description;
    case 'assignee':
      return detail.ticket.assignee;
    case 'comment-edit':
      return detail.activity.find((item) => matchesActivity(item, draft.activityId))?.text;
    case 'comment':
    case 'comment-send':
    case 'comment-back':
    case 'line-comment':
      return undefined;
  }
}

// The server trims names and comments, so spaces typed around them make no difference.
const comparable = (draft: StoredDraft, text: string): string =>
  draft.field === 'assignee' || draft.field === 'comment-edit' ? text.trim() : text;

export function checkDraft(draft: StoredDraft, server: string | undefined): DraftCheck {
  if (server === undefined) return 'gone';
  const now = comparable(draft, server);
  if (now === comparable(draft, draft.text)) return 'saved';
  return now === comparable(draft, draft.base) ? 'unchanged' : 'changed';
}
