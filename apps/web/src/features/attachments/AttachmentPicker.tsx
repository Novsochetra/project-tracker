import type { Attachment } from '@tracker/shared';
import clsx from 'clsx';
import { Paperclip } from 'lucide-react';
import { useEffect, useId, useRef, type FocusEvent } from 'react';
import { Button, pastFold, ShowMoreButton, useFold } from '../../components';
import styles from './AttachmentPicker.module.css';
import { FileInput } from './FileInput';
import { FileNote } from './FileNote';
import { measureRows } from './foldRows';
import { AddTile, ThumbnailGrid } from './ThumbnailGrid';
import type { AttachmentUploads } from './useAttachmentUploads';

export interface AttachmentPickerProps {
  attachments: readonly Attachment[];
  uploads: AttachmentUploads;
  onRemove: (id: string, index: number) => void;
  inputLabel: string;
  size?: 'md' | 'sm';
  onOpen?: ((index: number) => void) | undefined;
  markedId?: string | null | undefined;
  // Many files fold to two rows, as on the phone's ticket screen (docs/architecture.md §1.7).
  foldRows?: boolean;
  className?: string | undefined;
}

function AddFilesButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="text" size="sm" icon={Paperclip} className={styles.attach} onClick={onClick}>
      Add files
    </Button>
  );
}

// It tops the file area, where Add files was, so a big pick doesn't push it below the fold. A pick
// from the Add tile under many files can leave that top out of sight, so a refusal, which answers
// the pick just made, is brought into view; a failed upload comes later, while the person may be
// scrolling, and leaves the page where it is.
function PickNote({ uploads }: { uploads: AttachmentUploads }) {
  const ref = useRef<HTMLDivElement>(null);
  const { notice } = uploads;
  useEffect(() => {
    // At once: WebKit keeps what is on screen in place when the note lands above it, and that
    // shift could cut a smooth scroll off before it began.
    if (notice?.problem === 'refused') ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [notice]);
  if (!notice) return null;
  return (
    <FileNote ref={ref} notice={notice} onDismiss={uploads.dismissNotice} className={styles.note} />
  );
}

export function AttachmentPicker({
  attachments,
  uploads,
  onRemove,
  inputLabel,
  size,
  onOpen,
  markedId,
  foldRows = false,
  className,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLDivElement>(null);
  const filesId = useId();
  const pick = () => inputRef.current?.click();
  const empty = attachments.length === 0 && uploads.uploading.length === 0;
  const fold = useFold(filesRef, foldRows && !empty, attachments.length, measureRows);
  // Files added while folded (a drop, a paste) land past the fold, so it opens for good.
  if (fold.folded && uploads.uploading.length > 0) fold.expand();
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (fold.folded && pastFold(event.target, event.currentTarget)) fold.expand();
  };
  return (
    <div className={clsx(styles.picker, className)}>
      <PickNote uploads={uploads} />
      {empty ? (
        <AddFilesButton onClick={pick} />
      ) : (
        <div
          ref={filesRef}
          id={filesId}
          className={clsx(styles.files, fold.folded && styles.folded)}
          style={fold.folded ? { maxHeight: fold.height ?? undefined } : undefined}
          onFocus={onFocus}
        >
          <ThumbnailGrid
            attachments={attachments}
            uploading={uploads.uploading}
            onOpen={onOpen}
            onRemove={onRemove}
            onCancel={uploads.cancel}
            markedId={markedId}
            size={size}
          >
            {!fold.folded && <AddTile onClick={pick} data-add-tile="" />}
          </ThumbnailGrid>
        </div>
      )}
      {fold.height !== null && (
        <div className={styles.foldRow}>
          <ShowMoreButton
            expanded={fold.expanded}
            controls={filesId}
            moreLabel={`Show all ${attachments.length} files`}
            onClick={(event) => fold.toggle(event.currentTarget)}
          />
          {fold.folded && <AddFilesButton onClick={pick} />}
        </div>
      )}
      <FileInput ref={inputRef} label={inputLabel} onFiles={uploads.add} />
    </div>
  );
}
