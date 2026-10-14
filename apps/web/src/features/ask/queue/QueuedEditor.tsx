import { CHAT_QUESTION_MAX } from '@tracker/shared';
import { useEffect, useRef, useState } from 'react';
import { AutoTextarea, Button } from '../../../components';
import { CANCEL_LABEL, EDIT_QUEUED_LABEL, SAVE_LABEL } from './copy';
import styles from './Queue.module.css';

export interface QueuedEditorProps {
  text: string;
  busy: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function QueuedEditor({ text, busy, onSave, onCancel }: QueuedEditorProps) {
  const [draft, setDraft] = useState(text);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  const canSave = draft.trim() !== '' && !busy;
  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onSave(draft.trim());
      }}
    >
      <AutoTextarea
        aria-label={EDIT_QUEUED_LABEL}
        className={styles.input}
        rows={1}
        maxLength={CHAT_QUESTION_MAX}
        value={draft}
        ref={field}
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
      <div className={styles.actions}>
        <Button variant="text" size="sm" onClick={onCancel}>
          {CANCEL_LABEL}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!canSave}>
          {SAVE_LABEL}
        </Button>
      </div>
    </form>
  );
}
