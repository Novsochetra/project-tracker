import type { Attachment } from '@tracker/shared';
import { ThumbnailGrid } from '../attachments/ThumbnailGrid';
import { readableFiles } from '../attachments/readableFiles';
import { useAttachmentViewer } from '../attachments/viewerContext';
import styles from './ChatScreen.module.css';

function FileTiles({ files }: { files: Attachment[] }) {
  const viewer = useAttachmentViewer();
  return (
    <ThumbnailGrid
      size="sm"
      attachments={files}
      onOpen={(index) => viewer.open(files, index)}
      className={styles.sentFiles}
    />
  );
}

// The files a person sent with a question, opened in the usual viewers. An older tracker sends no
// list at all. Only a message with files needs the viewers' provider (the Shell's).
export function SentFiles({ attachments }: { attachments: Attachment[] | undefined }) {
  const files = readableFiles(attachments);
  return files.length > 0 ? <FileTiles files={files} /> : null;
}
