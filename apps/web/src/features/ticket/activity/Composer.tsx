import { Paperclip } from 'lucide-react';
import { useRef, type Ref } from 'react';
import { AutoTextarea, Button, IconButton } from '../../../components';
import { FileInput, FileNote, pasteFiles, ThumbnailGrid, useFileDrop } from '../../attachments';
import { COMMENT_MAX_LENGTH } from '../fields/limits';
import styles from './Composer.module.css';
import { isSubmitShortcut } from './commentRules';
import { useComposer } from './useComposer';

export interface ComposerProps {
  ticketKey: string;
  ref?: Ref<HTMLFormElement>;
}

export function Composer({ ticketKey, ref }: ComposerProps) {
  const composer = useComposer(ticketKey);
  const { attachments, files } = composer;
  const drop = useFileDrop(files.add);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      ref={ref}
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
        onPaste={(event) => pasteFiles(event, files.add)}
        onKeyDown={(event) => {
          if (!isSubmitShortcut(event)) return;
          event.preventDefault();
          composer.submit();
        }}
      />
      {(attachments.length > 0 || files.uploading.length > 0) && (
        <ThumbnailGrid
          size="sm"
          attachments={attachments}
          uploading={files.uploading}
          onRemove={files.remove}
          onCancel={files.cancel}
          className={styles.pending}
        />
      )}
      {files.notice && (
        <FileNote notice={files.notice} onDismiss={files.dismissNotice} className={styles.note} />
      )}
      <div className={styles.footer}>
        <IconButton
          aria-label="Attach files"
          icon={Paperclip}
          size="sm"
          className={styles.attach}
          onClick={() => inputRef.current?.click()}
        />
        <FileInput ref={inputRef} label="Attach files to comment" onFiles={files.add} />
        <Button type="submit" size="sm" disabled={!composer.canSubmit}>
          Comment
        </Button>
      </div>
    </form>
  );
}
