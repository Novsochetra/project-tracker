import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { AutoTextarea, Button, IconButton } from '../../../components';
import { ImageFileInput, pasteImages, ThumbnailGrid, useImageDrop } from '../../attachments';
import { COMMENT_MAX_LENGTH } from '../fields/limits';
import styles from './Composer.module.css';
import { isSubmitShortcut } from './commentRules';
import { useComposer } from './useComposer';

export function Composer({ ticketKey }: { ticketKey: string }) {
  const composer = useComposer(ticketKey);
  const { images, uploads } = composer;
  const drop = useImageDrop(uploads.add);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      className={styles.composer}
      data-dropping={drop.active || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        composer.submit();
      }}
      {...drop.handlers}
    >
      <AutoTextarea
        aria-label="Comment"
        placeholder="Leave a comment…"
        rows={2}
        className={styles.input}
        maxLength={COMMENT_MAX_LENGTH}
        value={composer.text}
        onChange={(event) => composer.setText(event.currentTarget.value)}
        onPaste={(event) => pasteImages(event, uploads.add)}
        onKeyDown={(event) => {
          if (!isSubmitShortcut(event)) return;
          event.preventDefault();
          composer.submit();
        }}
      />
      {(images.length > 0 || uploads.uploading > 0) && (
        <ThumbnailGrid
          size="sm"
          images={images}
          uploading={uploads.uploading}
          onRemove={composer.removeImage}
          className={styles.pending}
        />
      )}
      <div className={styles.footer}>
        <IconButton
          aria-label="Attach images"
          icon={ImagePlus}
          size="sm"
          className={styles.attach}
          onClick={() => inputRef.current?.click()}
        />
        <ImageFileInput ref={inputRef} label="Attach images to comment" onFiles={uploads.add} />
        <Button type="submit" size="sm" disabled={!composer.canSubmit}>
          Comment
        </Button>
      </div>
    </form>
  );
}
