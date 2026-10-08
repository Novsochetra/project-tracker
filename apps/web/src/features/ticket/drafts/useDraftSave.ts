import { useUpdateComment, useUpdateTicket } from '../../../api';
import type { StoredDraft } from '../../../lib/storedDrafts';

export type DraftSave = (draft: StoredDraft) => Promise<unknown>;

// Saves kept text for retries the app starts on its own. Through the same mutations as the
// screen, so the caches follow, the offline banner hears of failures and an app update waits for
// the write, but without a toast: the field's note or the app-wide toast says what happened.
export function useDraftSave(): DraftSave {
  const updateTicket = useUpdateTicket().mutateAsync;
  const updateComment = useUpdateComment().mutateAsync;
  return (draft) => {
    const { ticketKey, text } = draft;
    switch (draft.field) {
      case 'title':
        return updateTicket({ ticketKey, input: { title: text } });
      case 'description':
        return updateTicket({ ticketKey, input: { description: text } });
      case 'assignee':
        return updateTicket({ ticketKey, input: { assignee: text } });
      case 'comment-edit':
        return updateComment({ ticketKey, activityId: draft.activityId ?? '', text });
      case 'comment':
        return Promise.reject(new Error('The comment box is never sent for the user.'));
    }
  };
}
