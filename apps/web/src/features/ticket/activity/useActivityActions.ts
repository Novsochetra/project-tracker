import { errorMessage, useDeleteActivity, useUpdateComment } from '../../../api';
import { useToast } from '../../../components';

export interface ActivityActions {
  /** Resolves to whether the edit was saved; a failure is explained in a toast. */
  editComment: (activityId: string, text: string) => Promise<boolean>;
  remove: (activityId: string) => void;
}

export function useActivityActions(ticketKey: string): ActivityActions {
  const updateComment = useUpdateComment();
  const deleteActivity = useDeleteActivity();
  const { show } = useToast();
  const fail = (error: unknown) => show(errorMessage(error));
  return {
    editComment: (activityId, text) =>
      updateComment.mutateAsync({ ticketKey, activityId, text }).then(
        () => true,
        (error: unknown) => {
          fail(error);
          return false;
        },
      ),
    remove: (activityId) => {
      void deleteActivity.mutateAsync({ ticketKey, activityId }).catch(fail);
    },
  };
}
