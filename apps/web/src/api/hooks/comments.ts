import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Activity, Attachment, LineRef } from '@tracker/shared';
import {
  appendActivity,
  draftComment,
  editActivityText,
  removeActivity,
  replaceActivity,
  TEMPORARY_ID_PREFIX,
} from '../cache/ticketDetail';
import { ticketChange } from '../cacheChanges';
import { useApi } from '../context';
import { applyOptimistic, patchCaches, rollbackOnError } from '../optimistic';
import { settleMutation } from '../refresh';
import type { TrackerMutation } from '../types';

export interface AddCommentVariables {
  ticketKey: string;
  text: string;
  attachments?: Attachment[];
  // A comment on one line of a run's changes (the Changes tab).
  line?: LineRef;
}

export interface UpdateCommentVariables {
  ticketKey: string;
  activityId: string;
  text: string;
  // The text the edit was typed over: the tracker refuses it once the comment has newer text.
  expected?: string;
}

export interface DeleteActivityVariables {
  ticketKey: string;
  activityId: string;
}

let draftCount = 0;

function nextDraftId(): string {
  draftCount += 1;
  return `${TEMPORARY_ID_PREFIX}${draftCount}`;
}

export function useAddComment(): TrackerMutation<Activity, AddCommentVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey, text, attachments = [], line }: AddCommentVariables) =>
      client.addComment(ticketKey, {
        text,
        attachmentIds: attachments.map(({ id }) => id),
        ...(line ? { line } : {}),
      }),
    onMutate: async ({ ticketKey, text, attachments = [], line }) => {
      const draft = {
        id: nextDraftId(),
        text,
        attachments,
        createdAt: Date.now(),
        ...(line ? { line } : {}),
      };
      await applyOptimistic(queryClient, [
        ticketChange(ticketKey, (detail) => appendActivity(detail, draftComment(detail, draft))),
      ]);
      return draft.id;
    },
    onSuccess: (activity, { ticketKey }, draftId) =>
      patchCaches(queryClient, [
        ticketChange(ticketKey, (detail) => replaceActivity(detail, draftId, activity)),
      ]),
    onError: (_error, { ticketKey }, draftId) => {
      if (!draftId) return;
      ticketChange(ticketKey, (detail) => removeActivity(detail, draftId)).apply(queryClient);
    },
    onSettled: (_activity, _error, variables) => settleMutation(queryClient, variables),
  });
}

export function useUpdateComment(): TrackerMutation<Activity, UpdateCommentVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, text, expected }: UpdateCommentVariables) =>
      expected === undefined
        ? client.updateComment(activityId, { text })
        : client.updateComment(activityId, { text }, { text: expected }),
    onMutate: ({ ticketKey, activityId, text }) =>
      applyOptimistic(queryClient, [
        ticketChange(ticketKey, (detail) =>
          editActivityText(detail, activityId, text.trim(), Date.now()),
        ),
      ]),
    onError: rollbackOnError,
    onSettled: (_activity, _error, variables) => settleMutation(queryClient, variables),
  });
}

export function useDeleteActivity(): TrackerMutation<void, DeleteActivityVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId }: DeleteActivityVariables) => client.deleteActivity(activityId),
    onMutate: ({ ticketKey, activityId }) =>
      applyOptimistic(queryClient, [
        ticketChange(ticketKey, (detail) => removeActivity(detail, activityId)),
      ]),
    onError: rollbackOnError,
    onSettled: (_result, _error, variables) => settleMutation(queryClient, variables),
  });
}
