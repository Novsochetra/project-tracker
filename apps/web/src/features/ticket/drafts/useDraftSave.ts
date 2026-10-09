import { useUpdateComment, useUpdateTicket } from '../../../api';
import type { StoredDraft } from '../../../lib/storedDrafts';

export type DraftSave = (draft: StoredDraft) => Promise<unknown>;

// Saves kept text. Through the same mutations as the rest of the screen, so the caches follow, the
// offline banner hears of failures and an app update waits for the write, but without a toast:
// the caller says what happened. A save names the text it was typed over (`base`), so it can't
// overwrite newer text when it lands late.
export function useDraftSave(): DraftSave {
  const updateTicket = useUpdateTicket().mutateAsync;
  const updateComment = useUpdateComment().mutateAsync;
  return (draft) => {
    const { ticketKey, text, base } = draft;
    switch (draft.field) {
      case 'title':
        return updateTicket({ ticketKey, input: { title: text }, expected: { title: base } });
      case 'description':
        return updateTicket({
          ticketKey,
          input: { description: text },
          expected: { description: base },
        });
      case 'assignee':
        return updateTicket({ ticketKey, input: { assignee: text }, expected: { assignee: base } });
      case 'comment-edit':
        return updateComment({
          ticketKey,
          activityId: draft.activityId ?? '',
          text,
          expected: base,
        });
      case 'comment':
      case 'comment-send':
        return Promise.reject(new Error('The comment box is never sent for the user.'));
    }
  };
}
