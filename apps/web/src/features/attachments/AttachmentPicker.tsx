import type { Attachment } from '@tracker/shared';
import clsx from 'clsx';
import { Paperclip } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../../components';
import styles from './AttachmentPicker.module.css';
import { FileInput } from './FileInput';
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
  className?: string | undefined;
}

export function AttachmentPicker({
  attachments,
  uploads,
  onRemove,
  inputLabel,
  size,
  onOpen,
  markedId,
  className,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();
  const empty = attachments.length === 0 && uploads.uploading.length === 0;
  return (
    <div className={clsx(styles.picker, className)}>
      {empty ? (
        <Button variant="text" size="sm" icon={Paperclip} className={styles.attach} onClick={pick}>
          Add files
        </Button>
      ) : (
        <ThumbnailGrid
          attachments={attachments}
          uploading={uploads.uploading}
          onOpen={onOpen}
          onRemove={onRemove}
          onCancel={uploads.cancel}
          markedId={markedId}
          size={size}
        >
          <AddTile onClick={pick} />
        </ThumbnailGrid>
      )}
      <FileInput ref={inputRef} label={inputLabel} onFiles={uploads.add} />
    </div>
  );
}
