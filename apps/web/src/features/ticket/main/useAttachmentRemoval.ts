import { attachmentKind, type Attachment } from '@tracker/shared';
import { useRef, useState } from 'react';
import { errorMessage, useDeleteAttachment } from '../../../api';
import { useToast } from '../../../components';

export interface AttachmentRemovalTarget {
  id: string;
  label: string;
  noun: string;
}

export interface AttachmentRemoval {
  // Kept after the answer, so the phone sheet still has its text while it animates out.
  target: AttachmentRemovalTarget | null;
  asking: boolean;
  ask: (attachment: Attachment, label: string) => void;
  cancel: () => void;
  confirm: () => void;
}

function nounOf(attachment: Attachment): string {
  const kind = attachmentKind(attachment.mimeType);
  return kind === 'image' || kind === 'video' ? kind : 'file';
}

export function useAttachmentRemoval(ticketKey: string): AttachmentRemoval {
  const [target, setTarget] = useState<AttachmentRemovalTarget | null>(null);
  const [asking, setAsking] = useState(false);
  const askedFromRef = useRef<HTMLElement | null>(null);
  const removeAttachment = useDeleteAttachment();
  const { show } = useToast();
  return {
    target,
    asking,
    ask: (attachment, label) => {
      const focused = document.activeElement;
      askedFromRef.current = focused instanceof HTMLElement ? focused : null;
      setTarget({ id: attachment.id, label, noun: nounOf(attachment) });
      setAsking(true);
    },
    cancel: () => {
      setAsking(false);
      // The confirm took focus from the x, so give it back when nothing is removed.
      askedFromRef.current?.focus({ preventScroll: true });
    },
    confirm: () => {
      setAsking(false);
      if (!target) return;
      void removeAttachment
        .mutateAsync({ attachmentId: target.id, ticketKey })
        .catch((error: unknown) => show(errorMessage(error), { kind: 'error' }));
    },
  };
}
