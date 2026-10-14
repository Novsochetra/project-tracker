import { FileNotes } from '../attachments/FileNote';
import { ThumbnailGrid } from '../attachments/ThumbnailGrid';
import styles from './ChatScreen.module.css';
import { WithheldNote } from './messageFiles/WithheldNote';
import type { QuestionFiles } from './useQuestionFiles';

export function QuestionFilesArea({ question }: { question: QuestionFiles }) {
  const { attachments, files } = question;
  return (
    <>
      {(attachments.length > 0 || files.uploading.length > 0) && (
        <ThumbnailGrid
          size="sm"
          attachments={attachments}
          uploading={files.uploading}
          onRemove={files.remove}
          onCancel={files.cancel}
          className={styles.questionFiles}
        />
      )}
      <WithheldNote files={attachments} />
      <FileNotes notices={files.notices} onDismiss={files.dismissNotice} />
    </>
  );
}
