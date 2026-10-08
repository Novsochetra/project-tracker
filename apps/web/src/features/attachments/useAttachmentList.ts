import type { Attachment } from '@tracker/shared';
import type { Dispatch, SetStateAction } from 'react';
import { useDeleteAttachment } from '../../api';
import { useAttachmentUploads, type AttachmentUploads } from './useAttachmentUploads';

export interface AttachmentList extends AttachmentUploads {
  remove: (attachmentId: string) => void;
  /** Stops the uploads and deletes the uploaded files of a form that is thrown away. */
  discard: (attachments: readonly Attachment[]) => void;
}

/**
 * Files for something not created yet (a ticket, a comment): they upload right away and wait on
 * the server until it is created with them. The caller keeps the uploaded ones.
 */
export function useAttachmentList(setAttachments: Dispatch<SetStateAction<Attachment[]>>) {
  const uploads = useAttachmentUploads({
    onUploaded: (attachment) => setAttachments((current) => [...current, attachment]),
  });
  const deleteAttachment = useDeleteAttachment();
  // Unused uploads expire on the server anyway, so a failed cleanup needs no message.
  const forget = (attachmentId: string) => deleteAttachment.mutate({ attachmentId });
  const list: AttachmentList = {
    ...uploads,
    remove: (attachmentId) => {
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
      forget(attachmentId);
    },
    discard: (attachments) => {
      uploads.cancelAll();
      attachments.forEach((attachment) => forget(attachment.id));
    },
  };
  return list;
}
