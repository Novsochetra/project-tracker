import { useEffect, useRef, useState } from 'react';
import { AutoTextarea, Button } from '../../../components';
import { COMMENT_MAX_LENGTH } from '../fields/limits';
import { useDraftMark } from '../fields/useDraftMark';
import styles from './CommentEditor.module.css';
import { isSubmitShortcut } from './commentRules';

export interface CommentEditorProps {
  /** Names the unsaved edit for the drafts contract, such as "comment-edit:<id>". */
  draftId: string;
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function CommentEditor({ draftId, initial, onSave, onCancel }: CommentEditorProps) {
  const [text, setText] = useState(initial);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const blank = text.trim() === '';
  useDraftMark(draftId, text !== initial);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const save = () => {
    if (!blank) onSave(text);
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
          className={styles.input}
          maxLength={COMMENT_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            } else if (isSubmitShortcut(event)) {
              event.preventDefault();
              save();
            }
          }}
        />
      </div>
      <div className={styles.actions}>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={blank}>
          Save
        </Button>
      </div>
    </form>
  );
}
