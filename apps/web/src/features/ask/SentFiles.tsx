import type { Attachment } from '@tracker/shared';
import { ThumbnailGrid } from '../attachments/ThumbnailGrid';
import { useAttachmentViewer } from '../attachments/viewerContext';
import { readableFiles } from '../attachments/readableFiles';
import styles from './ChatScreen.module.css';

// The files a person sent with a question, opened in the usual viewers. An older tracker sends no
// list at all.
export function SentFiles({ attachments }: { attachments: Attachment[] | undefined }) {
  const viewer = useAttachmentViewer();
  const files = readableFiles(attachments);
  if (files.length === 0) return null;
  return (
    <ThumbnailGrid
      size="sm"
      attachments={files}
      onOpen={(index) => viewer.open(files, index)}
      className={styles.sentFiles}
    />
  );
}
