import { useEffect, useId, useRef } from 'react';
import { AutoTextarea, Button } from '../../../components';
import { COMMENT_MAX_LENGTH } from '../fields/limits';
import { UnsavedNote } from '../fields/UnsavedNote';
import styles from './CommentEditor.module.css';
import { isSubmitShortcut } from './commentRules';
import type { CommentEdit } from './useCommentEdit';

export function CommentEditor({ edit }: { edit: CommentEdit }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const blank = edit.text.trim() === '';

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const save = () => {
    if (!blank) edit.save();
  };
  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className={styles.field}>
        <AutoTextarea
          ref={inputRef}
          aria-label="Edit comment"
          aria-describedby={edit.failed ? noteId : undefined}
          className={styles.input}
          maxLength={COMMENT_MAX_LENGTH}
          value={edit.text}
          onChange={(event) => edit.setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              edit.cancel();
            } else if (isSubmitShortcut(event)) {
              event.preventDefault();
              save();
            }
          }}
        />
      </div>
      <div className={styles.actions}>
        {edit.failed && <UnsavedNote id={noteId} subject="Your edit" className={styles.unsaved} />}
        <Button size="sm" onClick={edit.cancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={blank}>
          Save
        </Button>
      </div>
    </form>
  );
}
