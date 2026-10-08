import type { Attachment } from '@tracker/shared';
import {
  AttachmentPicker,
  thumbnailLabels,
  useAttachmentViewer,
  type AttachmentUploads,
} from '../../attachments';
import { RemoveAttachmentConfirm } from './RemoveAttachmentConfirm';
import styles from './TicketMain.module.css';
import { useAttachmentRemoval } from './useAttachmentRemoval';

export interface TicketAttachmentsProps {
  ticketKey: string;
  attachments: Attachment[];
  uploads: AttachmentUploads;
}

export function TicketAttachments({ ticketKey, attachments, uploads }: TicketAttachmentsProps) {
  const viewer = useAttachmentViewer();
  const removal = useAttachmentRemoval(ticketKey);
  const labels = thumbnailLabels(attachments);
  const empty = attachments.length === 0 && uploads.uploading.length === 0;
  return (
    <>
      <AttachmentPicker
        attachments={attachments}
        uploads={uploads}
        inputLabel="Add files to ticket"
        onOpen={(index) => viewer.open(attachments, index)}
        onRemove={(id, index) => {
          const attachment = attachments.find((candidate) => candidate.id === id);
          if (attachment) removal.ask(attachment, labels[index] ?? attachment.fileName);
        }}
        markedId={removal.asking ? removal.target?.id : null}
        className={empty ? undefined : styles.attachments}
      />
      {/* Stays mounted when the last attachment goes, so the phone sheet can finish closing. */}
      <RemoveAttachmentConfirm removal={removal} />
    </>
  );
}
