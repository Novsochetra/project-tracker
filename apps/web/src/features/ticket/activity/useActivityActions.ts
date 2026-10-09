import { errorMessage, isStaleEdit, useDeleteActivity, useUpdateComment } from '../../../api';
import { useToast } from '../../../components';
import { draftIdOf, forgetDraft } from '../../../lib/storedDrafts';
import type { SendResult } from './commentEdit';

export interface ActivityActions {
  ticketKey: string;
  // `expected`: the text the edit was typed over.
  editComment: (activityId: string, text: string, expected: string) => Promise<SendResult>;
  remove: (activityId: string) => void;
}

export function useActivityActions(ticketKey: string): ActivityActions {
  const updateComment = useUpdateComment();
  const deleteActivity = useDeleteActivity();
  const { show } = useToast();
  const fail = (error: unknown) => show(errorMessage(error), { kind: 'error' });
  return {
    ticketKey,
    // A refused edit gets no toast: its editor says the comment changed elsewhere.
    editComment: (activityId, text, expected) =>
      updateComment.mutateAsync({ ticketKey, activityId, text, expected }).then(
        () => 'saved',
        (error: unknown) => {
          if (isStaleEdit(error)) return 'stale';
          fail(error);
          return 'failed';
        },
      ),
    remove: (activityId) => {
      void deleteActivity.mutateAsync({ ticketKey, activityId }).then(
        // An edit kept for a deleted comment has nothing left to save into.
        () => forgetDraft(draftIdOf({ ticketKey, field: 'comment-edit', activityId })),
        fail,
      );
    },
  };
}
