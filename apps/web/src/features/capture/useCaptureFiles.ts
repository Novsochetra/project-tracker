import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { useAttachmentList, type AttachmentList } from '../attachments';

export interface CaptureFiles extends AttachmentList {
  items: Attachment[];
}

/** Files upload right away and wait on the server until the ticket is created with them. */
export function useCaptureFiles(): CaptureFiles {
  const [items, setItems] = useState<Attachment[]>([]);
  return { ...useAttachmentList(setItems), items };
}
