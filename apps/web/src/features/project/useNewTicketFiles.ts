import type { Attachment } from '@tracker/shared';
import type { Dispatch, SetStateAction } from 'react';
import { useDraftMark } from '../../lib/useDraftMark';
import { useAttachmentList, type AttachmentList } from '../attachments';
import type { NewTicketForm } from './newTicketForm';

/**
 * The sheet's files live in its form, so the kept fields bring the uploaded ones back after a
 * reload. Files still on their way can't come back, so closing the page asks while they go.
 */
export function useNewTicketFiles(
  setForm: Dispatch<SetStateAction<NewTicketForm>>,
  projectKey: string,
  open: boolean,
): AttachmentList {
  const setAttachments = (next: SetStateAction<Attachment[]>) =>
    setForm((current) => ({
      ...current,
      attachments: typeof next === 'function' ? next(current.attachments) : next,
    }));
  const files = useAttachmentList(setAttachments);
  useDraftMark(`new-ticket-files:${projectKey}`, open && files.uploading.length > 0);
  return files;
}
