import type { Attachment } from '@tracker/shared';
import type { Dispatch, SetStateAction } from 'react';
import { useDeleteAttachment } from '../../api';
import type { FileLimit } from './attachmentFiles';
import { useAttachmentUploads, type AttachmentUploads } from './useAttachmentUploads';

export interface AttachmentList extends AttachmentUploads {
  remove: (attachmentId: string) => void;
  discard: (attachments: readonly Attachment[]) => void;
}

// Files upload before their ticket or comment exists and wait on the server until it is created
// with them.
export function useAttachmentList(
  setAttachments: Dispatch<SetStateAction<Attachment[]>>,
  limit: FileLimit,
) {
  const uploads = useAttachmentUploads({
    onUploaded: (attachment) => setAttachments((current) => [...current, attachment]),
    limit,
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
