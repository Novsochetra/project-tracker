import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { useAttachmentList, type AttachmentList } from '../attachments';

export interface CaptureFiles extends AttachmentList {
  items: Attachment[];
}

export function useCaptureFiles(): CaptureFiles {
  const [items, setItems] = useState<Attachment[]>([]);
  return { ...useAttachmentList(setItems, { owner: 'ticket', attached: items.length }), items };
}
