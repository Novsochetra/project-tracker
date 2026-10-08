import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Attachment } from '@tracker/shared';
import { prepareUpload } from '../../lib/uploads';
import { addTicketAttachment, removeAttachment } from '../cache/ticketDetail';
import { ticketChange } from '../cacheChanges';
import { useApi } from '../context';
import { applyOptimistic, patchCaches, rollbackOnError } from '../optimistic';
import { queryKeys } from '../queryKeys';
import { settleMutation } from '../refresh';
import type { TrackerMutation, TrackerQuery } from '../types';

export interface UploadAttachmentVariables {
  file: File;
  ticketKey?: string | undefined;
  /** The part of the file sent so far, from 0 to 1. */
  onProgress?: ((fraction: number) => void) | undefined;
  signal?: AbortSignal | undefined;
}

export interface DeleteAttachmentVariables {
  attachmentId: string;
  ticketKey?: string;
}

export function useUploadAttachment(): TrackerMutation<Attachment, UploadAttachmentVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, ticketKey, onProgress, signal }: UploadAttachmentVariables) => {
      const { blob, fileName } = await prepareUpload(file);
      return client.uploadAttachment(blob, fileName, ticketKey, {
        onProgress: (sent, total) => onProgress?.(total > 0 ? sent / total : 0),
        signal,
      });
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

/** A text attachment's content, read while attachmentId is set. */
export function useAttachmentText(attachmentId: string | null): TrackerQuery<string> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.attachmentText(attachmentId ?? ''),
    queryFn: () => client.fetchAttachmentText(attachmentId ?? ''),
    enabled: attachmentId !== null,
    // A file never changes once it is uploaded.
    staleTime: Infinity,
  });
}
