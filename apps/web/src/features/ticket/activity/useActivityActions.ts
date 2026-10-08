import { errorMessage, useDeleteActivity, useUpdateComment } from '../../../api';
import { useToast } from '../../../components';
import { draftIdOf, forgetDraft } from '../../../lib/storedDrafts';

export interface ActivityActions {
  ticketKey: string;
  editComment: (activityId: string, text: string) => Promise<boolean>;
  remove: (activityId: string) => void;
}

export function useActivityActions(ticketKey: string): ActivityActions {
  const updateComment = useUpdateComment();
  const deleteActivity = useDeleteActivity();
  const { show } = useToast();
  const fail = (error: unknown) => show(errorMessage(error), { kind: 'error' });
  return {
    ticketKey,
    editComment: (activityId, text) =>
      updateComment.mutateAsync({ ticketKey, activityId, text }).then(
        () => true,
        (error: unknown) => {
          fail(error);
          return false;
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
