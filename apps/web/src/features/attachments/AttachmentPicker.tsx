import type { Attachment } from '@tracker/shared';
import clsx from 'clsx';
import { Paperclip } from 'lucide-react';
import { useEffect, useId, useRef, type FocusEvent, type Ref } from 'react';
import { Button, pastFold, ShowMoreButton, useFold } from '../../components';
import styles from './AttachmentPicker.module.css';
import { FileInput } from './FileInput';
import { FileNote } from './FileNote';
import { measureRows } from './foldRows';
import { AddTile, ThumbnailGrid } from './ThumbnailGrid';
import type { FileNotice } from './fileNotice';
import type { AttachmentUploads } from './useAttachmentUploads';
import { useToastIfUnseen } from './useToastIfUnseen';

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

function AddFilesButton({ onClick, ref }: { onClick: () => void; ref: Ref<HTMLButtonElement> }) {
  return (
    <Button
      ref={ref}
      variant="text"
      size="sm"
      icon={Paperclip}
      className={styles.attach}
      onClick={onClick}
    >
      Add files
    </Button>
  );
}

interface NoteProps {
  notice: FileNotice | null;
  onDismiss: () => void;
  // Add files: both notes answer a pick, so a key press on Dismiss leaves focus where files are added.
  focusTo: () => HTMLElement | null;
}

// What a pick left out tops the file area, where Add files was, so a big pick doesn't push it below
// the fold. A pick from the Add tile under many files can leave that top out of sight, so it is
// brought into view: it answers the pick just made.
function PickNote({ notice, onDismiss, focusTo }: NoteProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // At once: WebKit keeps what is on screen in place when the note lands above it, and that
    // shift could cut a smooth scroll off before it began.
    if (notice) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [notice]);
  if (!notice) return null;
  return (
    <FileNote
      ref={ref}
      notice={notice}
      onDismiss={onDismiss}
      focusTo={focusTo}
      className={clsx(styles.note, styles.pickNote)}
    />
  );
}

// An upload fails later, while the person may be anywhere, and Safari keeps no scroll anchor: a
// note above the files would push down every tile on screen, or land unseen above them. Below the
// files it moves only what is under it; where that is out of sight, a toast says it too.
function LateNote({ notice, onDismiss, focusTo }: NoteProps) {
  const ref = useRef<HTMLDivElement>(null);
  useToastIfUnseen(ref, notice);
  if (!notice) return null;
  return (
    <FileNote
      ref={ref}
      notice={notice}
      onDismiss={onDismiss}
      focusTo={focusTo}
      className={clsx(styles.note, styles.lateNote)}
    />
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
  const addRef = useRef<HTMLButtonElement>(null);
  const focusAdd = () => addRef.current;
  const filesId = useId();
  const pick = () => inputRef.current?.click();
  const empty = attachments.length === 0 && uploads.tiles.length === 0;
  const fold = useFold(filesRef, foldRows && !empty, attachments.length, measureRows);
  // Files added while folded (a drop, a paste) land past the fold, so it opens for good.
  if (fold.folded && uploads.uploading.length > 0) fold.expand();
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (fold.folded && pastFold(event.target, event.currentTarget)) fold.expand();
  };
  return (
    <div className={clsx(styles.picker, className)}>
      <PickNote
        notice={uploads.notices.refused}
        onDismiss={() => uploads.dismissNotice('refused')}
        focusTo={focusAdd}
      />
      {empty ? (
        <AddFilesButton ref={addRef} onClick={pick} />
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
            uploading={uploads.tiles}
            onOpen={onOpen}
            onRemove={onRemove}
            onCancel={uploads.cancel}
            markedId={markedId}
            size={size}
          >
            {!fold.folded && <AddTile ref={addRef} onClick={pick} data-add-tile="" />}
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
          {fold.folded && <AddFilesButton ref={addRef} onClick={pick} />}
        </div>
      )}
      <LateNote
        notice={uploads.notices.failed}
        onDismiss={() => uploads.dismissNotice('failed')}
        focusTo={focusAdd}
      />
      <FileInput ref={inputRef} label={inputLabel} onFiles={uploads.add} />
    </div>
  );
}
