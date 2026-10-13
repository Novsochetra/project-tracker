import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { useAttachmentList, type AttachmentList } from '../attachments/useAttachmentList';
import { useFileDrop, type FileDrop } from '../attachments/useFileDrop';

export interface QuestionFiles {
  attachments: Attachment[];
  files: AttachmentList;
  drop: FileDrop;
  // Files still on their way hold Send back, as they hold Comment.
  uploading: boolean;
  count: number;
  clear: () => void;
}

// The comment box's flow (§1.4): each file uploads as a pending one when picked, and the question
// sends their ids.
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
