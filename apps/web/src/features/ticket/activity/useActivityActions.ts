import { errorMessage, useDeleteActivity, useUpdateComment } from '../../../api';
import { useToast } from '../../../components';

export interface ActivityActions {
  editComment: (activityId: string, text: string) => void;
  remove: (activityId: string) => void;
}

export function useActivityActions(ticketKey: string): ActivityActions {
  const updateComment = useUpdateComment();
  const deleteActivity = useDeleteActivity();
  const { show } = useToast();
  const fail = (error: unknown) => show(errorMessage(error));
  return {
    editComment: (activityId, text) => {
      void updateComment.mutateAsync({ ticketKey, activityId, text }).catch(fail);
    },
    remove: (activityId) => {
      void deleteActivity.mutateAsync({ ticketKey, activityId }).catch(fail);
    },
  };
}
