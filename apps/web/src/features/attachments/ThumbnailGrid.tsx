import type { Attachment } from '@tracker/shared';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '../../components';
import { SavedThumbnail } from './SavedThumbnail';
import styles from './ThumbnailGrid.module.css';
import { thumbnailLabels } from './thumbnailLabels';
import './tokens.css';
import { UploadThumbnail } from './UploadThumbnail';
import type { UploadingFile } from './useAttachmentUploads';

export interface ThumbnailGridProps {
  attachments: readonly Attachment[];
  uploading?: readonly UploadingFile[] | undefined;
  onOpen?: ((index: number) => void) | undefined;
  onRemove?: ((id: string, index: number) => void) | undefined;
  onCancel?: ((key: string) => void) | undefined;
  // The attachment a removal is being confirmed for, so it is clear which one goes.
  markedId?: string | null | undefined;
  size?: 'md' | 'sm';
  children?: ReactNode;
  className?: string | undefined;
}

const NOTHING_UPLOADING: readonly UploadingFile[] = [];

export function ThumbnailGrid({
  attachments,
  uploading = NOTHING_UPLOADING,
  onOpen,
  onRemove,
  onCancel,
  markedId,
  size = 'md',
  children,
  className,
}: ThumbnailGridProps) {
  const labels = thumbnailLabels(attachments);
  const removable = onRemove !== undefined || (onCancel !== undefined && uploading.length > 0);
  return (
    <div className={clsx(styles.grid, styles[size], removable && styles.removable, className)}>
      {attachments.map((attachment, index) => (
        <SavedThumbnail
          key={attachment.id}
          attachment={attachment}
          label={labels[index] ?? attachment.fileName}
          marked={attachment.id === markedId}
          onOpen={onOpen && (() => onOpen(index))}
          onRemove={onRemove && (() => onRemove(attachment.id, index))}
        />
      ))}
      {uploading.map((file) => (
        <UploadThumbnail
          key={file.key}
          file={file}
          onCancel={onCancel && (() => onCancel(file.key))}
        />
      ))}
      {children}
    </div>
  );
}

export type AddTileProps = Omit<ComponentProps<'button'>, 'children'>;

export function AddTile({ className, ...rest }: AddTileProps) {
  return (
    <button
      type="button"
      aria-label="Add files"
      className={clsx(styles.tile, styles.add, className)}
      {...rest}
    >
      <Icon icon={Plus} size={20} />
    </button>
  );
}
