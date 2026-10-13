import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { useAttachmentList, type AttachmentList } from '../attachments/useAttachmentList';
import { useFileDrop, type FileDrop } from '../attachments/useFileDrop';

export interface QuestionFiles {
  attachments: Attachment[];
  files: AttachmentList;
  drop: FileDrop;
  uploading: boolean;
  count: number;
  clear: () => void;
}

export function useQuestionFiles(): QuestionFiles {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const files = useAttachmentList(setAttachments, {
    owner: 'question',
    attached: attachments.length,
  });
  const drop = useFileDrop(files.add);
  return {
    attachments,
    files,
    drop,
    uploading: files.uploading.length > 0,
    count: attachments.length + files.uploading.length,
    clear: () => {
      setAttachments([]);
      files.dismissNotice();
    },
  };
}
