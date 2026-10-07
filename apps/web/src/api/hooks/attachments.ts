import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Attachment } from '@tracker/shared';
import { prepareImageForUpload } from '../../lib/images';
import { addTicketAttachment, removeAttachment } from '../cache/ticketDetail';
import { ticketChange } from '../cacheChanges';
import { useApi } from '../context';
import { applyOptimistic, patchCaches, rollbackOnError } from '../optimistic';
import { settleMutation } from '../refresh';
import type { TrackerMutation } from '../types';

export interface UploadAttachmentVariables {
  file: File;
  ticketKey?: string;
}

export interface DeleteAttachmentVariables {
  attachmentId: string;
  ticketKey?: string;
}

export function useUploadAttachment(): TrackerMutation<Attachment, UploadAttachmentVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, ticketKey }: UploadAttachmentVariables) => {
      const { blob, fileName } = await prepareImageForUpload(file);
      return client.uploadAttachment(blob, fileName, ticketKey);
    },
    onSuccess: (attachment, { ticketKey }) =>
      ticketKey
        ? patchCaches(queryClient, [
            ticketChange(ticketKey, (detail) => addTicketAttachment(detail, attachment)),
          ])
        : undefined,
    onSettled: (_attachment, _error, variables) => settleMutation(queryClient, variables),
  });
}

export function useDeleteAttachment(): TrackerMutation<void, DeleteAttachmentVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId }: DeleteAttachmentVariables) =>
      client.deleteAttachment(attachmentId),
    onMutate: ({ attachmentId, ticketKey }) =>
      applyOptimistic(
        queryClient,
        ticketKey
          ? [ticketChange(ticketKey, (detail) => removeAttachment(detail, attachmentId))]
          : [],
      ),
    onError: rollbackOnError,
    onSettled: (_result, _error, variables) => settleMutation(queryClient, variables),
  });
}
