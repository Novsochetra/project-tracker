import { useEffect, useId, useRef, useState } from 'react';
import { AutoTextarea, Button } from '../../../components';
import { COMMENT_MAX_LENGTH } from '../fields/limits';
import { UnsavedNote } from '../fields/UnsavedNote';
import styles from './CommentEditor.module.css';
import { isSubmitShortcut } from './commentRules';
import type { CommentEdit } from './useCommentEdit';

function noteFor(edit: CommentEdit): string | null {
  if (edit.changed) return "The comment changed elsewhere while your edit wasn't saved.";
  return edit.failed ? "Your edit isn't saved yet." : null;
}

export function CommentEditor({ edit }: { edit: CommentEdit }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const blank = edit.text.trim() === '';
  const note = noteFor(edit);
  // Only an editor the user just opened takes focus. One kept from an earlier visit, or reopened
  // by a failed save after the user moved on, would pop up the keyboard.
  const [focusOnOpen] = useState(!edit.failed && !edit.restored);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !focusOnOpen) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, [focusOnOpen]);

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
          aria-describedby={note ? noteId : undefined}
          className={styles.input}
          maxLength={COMMENT_MAX_LENGTH}
          value={edit.text}
          onChange={(event) => edit.setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            // An Escape something used first, like one that dropped a file's viewer still on its
            // way (PT-114), leaves the edit open, as overlays leave it.
            if (event.key === 'Escape' && !event.defaultPrevented) {
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
        {note && <UnsavedNote id={noteId} message={note} className={styles.unsaved} />}
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
