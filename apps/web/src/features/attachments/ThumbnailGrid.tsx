import clsx from 'clsx';
import { ImagePlus, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon, Spinner } from '../../components';
import styles from './ThumbnailGrid.module.css';

export interface ThumbnailImage {
  id: string;
  url: string;
}

export interface ThumbnailGridProps {
  images: readonly ThumbnailImage[];
  /** Makes each thumbnail a button named "Open image {n}". */
  onOpen?: ((index: number) => void) | undefined;
  /** Adds a small x named "Remove image {n}". */
  onRemove?: ((id: string, index: number) => void) | undefined;
  /** The image a removal is being confirmed for, so it is clear which one goes. */
  markedId?: string | null | undefined;
  uploading?: number;
  size?: 'md' | 'sm';
  children?: ReactNode;
  className?: string | undefined;
}

export function ThumbnailGrid({
  images,
  onOpen,
  onRemove,
  markedId,
  uploading = 0,
  size = 'md',
  children,
  className,
}: ThumbnailGridProps) {
  return (
    <div className={clsx(styles.grid, styles[size], onRemove && styles.removable, className)}>
      {images.map((image, index) => (
        <div key={image.id} className={clsx(styles.tile, image.id === markedId && styles.marked)}>
          <Thumbnail image={image} number={index + 1} onOpen={onOpen && (() => onOpen(index))} />
          {onRemove && (
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove image ${index + 1}`}
              onClick={() => onRemove(image.id, index)}
            >
              <Icon icon={X} size={14} />
            </button>
          )}
        </div>
      ))}
      {Array.from({ length: uploading }, (_, index) => (
        <div key={`uploading-${index}`} className={clsx(styles.tile, styles.frame, styles.busy)}>
          <Spinner label="Uploading image" />
        </div>
      ))}
      {children}
    </div>
  );
}

interface ThumbnailProps {
  image: ThumbnailImage;
  number: number;
  onOpen: (() => void) | undefined;
}

function Thumbnail({ image, number, onOpen }: ThumbnailProps) {
  if (!onOpen) {
    return (
      <img
        className={styles.frame}
        src={image.url}
        alt={`Attachment ${number}`}
        draggable={false}
      />
    );
  }
  return (
    <button
      type="button"
      className={clsx(styles.frame, styles.open)}
      aria-label={`Open image ${number}`}
      onClick={onOpen}
    >
      <img src={image.url} alt="" loading="lazy" decoding="async" draggable={false} />
    </button>
  );
}

export type AddImageTileProps = Omit<ComponentProps<'button'>, 'children'>;

export function AddImageTile({ className, ...rest }: AddImageTileProps) {
  return (
    <button
      type="button"
      aria-label="Add images"
      className={clsx(styles.tile, styles.add, className)}
      {...rest}
    >
      <Icon icon={ImagePlus} size={20} />
    </button>
  );
}
