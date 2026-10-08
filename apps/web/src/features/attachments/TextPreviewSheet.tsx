import { formatBytes, type Attachment } from '@tracker/shared';
import { errorMessage, useAttachmentText } from '../../api';
import { Button, Spinner } from '../../components';
import { Sheet, SheetTextButton } from '../../overlays';
import { TEXT_PREVIEW_MAX_CHARS, textPreview } from './textPreview';
import styles from './TextPreviewSheet.module.css';

export interface TextPreviewSheetProps {
  attachment: Attachment | null;
  open: boolean;
  onClose: () => void;
}

const LIMIT = new Intl.NumberFormat('en-US').format(TEXT_PREVIEW_MAX_CHARS);

function PreviewBody({ attachment }: { attachment: Attachment }) {
  const query = useAttachmentText(attachment.id);
  if (query.isError) {
    return (
      <div className={styles.state}>
        <p role="alert" className={styles.error}>
          {errorMessage(query.error)}
        </p>
        <Button size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className={styles.state}>
        <Spinner label={`Loading ${attachment.fileName}`} />
      </div>
    );
  }
  const preview = textPreview(query.data);
  return (
    <>
      <pre className={styles.text}>{preview.text}</pre>
      {preview.cut && (
        <p className={styles.cut}>
          <span>Showing the first {LIMIT} characters.</span>{' '}
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Open the whole file
          </a>
        </p>
      )}
    </>
  );
}

/** A text file to read in the app: monospaced, wrapped, scrolling, swiped down to close. */
export function TextPreviewSheet({ attachment, open, onClose }: TextPreviewSheetProps) {
  if (!attachment) return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={attachment.fileName}
      title={attachment.fileName}
      subtitle={formatBytes(attachment.size)}
      size="report"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      <div className={styles.body}>
        <PreviewBody attachment={attachment} />
      </div>
    </Sheet>
  );
}
