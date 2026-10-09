import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { errorMessage } from '../../api';
import { Button, GroupedCard, SelectRow, StatusGlyph } from '../../components';
import { isPhoneNow } from '../../lib/media';
import { holdPresses } from '../../lib/holdPresses';
import { ColorSwatches } from './ColorSwatches';
import { DeleteStatus } from './DeleteStatus';
import styles from './StatusEditor.module.css';
import { LAST_STATUS_HINT, canDeleteStatus, nameIssueMessage } from './statusForm';
import { categoryOptions } from './statusOptions';
import { useEscapeKey } from './useEscapeKey';
import {
  useStatusEditor,
  type StatusEditorState,
  type StatusEditorTarget,
} from './useStatusEditor';

export interface StatusEditorProps extends StatusEditorTarget {
  count: number;
  onDirtyChange: (dirty: boolean) => void;
}

// The sheet asks before it closes over an unsaved edit, so it has to know about one.
function useNotifyDirty(dirty: boolean, onDirtyChange: (dirty: boolean) => void): void {
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
}

export function StatusEditor(props: StatusEditorProps) {
  const { status, onDone } = props;
  const editor = useStatusEditor(props);
  useNotifyDirty(editor.dirty, props.onDirtyChange);
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Phones keep the keyboard down until the person taps the name.
    const target = isPhoneNow() ? formRef.current : nameRef.current;
    target?.focus({ preventScroll: true });
  }, []);
  useEscapeKey(formRef, () => onDone(status?.id));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    editor.save();
  };
  // The confirm is shorter than the editor it replaces, so Add status below moves up under the
  // finger, or the confirm's Delete lands there: a double tap's second tap pressed either.
  const askDelete = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    setDeleting(true);
  };
  return (
    <form
      ref={formRef}
      tabIndex={-1}
      aria-label={status ? `Edit ${status.name}` : 'New status'}
      className={clsx(styles.editor, 'fade-in')}
      onSubmit={submit}
      noValidate
    >
      {deleting && status ? (
        <DeleteStatus
          {...props}
          status={status}
          onCancel={() => setDeleting(false)}
          onDeleted={() => props.onDeleted(status.id)}
        />
      ) : (
        <EditorFields {...props} editor={editor} nameRef={nameRef} onDelete={askDelete} />
      )}
    </form>
  );
}

interface EditorFieldsProps extends StatusEditorProps {
  editor: StatusEditorState;
  nameRef: RefObject<HTMLInputElement | null>;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}

function EditorFields({ editor, nameRef, status, statuses, onDone, onDelete }: EditorFieldsProps) {
  const { draft, change, issue } = editor;
  const deletable = canDeleteStatus(statuses);
  return (
    <>
      <div className={styles.nameRow}>
        <StatusGlyph category={draft.category} color={draft.color} animated={false} />
        <input
          ref={nameRef}
          className={styles.nameInput}
          aria-label="Status name"
          placeholder="Status name"
          maxLength={40}
          autoComplete="off"
          value={draft.name}
          onChange={(event) => change({ name: event.target.value })}
        />
      </div>
      <GroupedCard>
        <SelectRow
          label="Type"
          options={categoryOptions(draft.color)}
          value={draft.category}
          onChange={(category) => change({ category })}
        />
      </GroupedCard>
      <ColorSwatches value={draft.color} onChange={(color) => change({ color })} />
      {issue?.kind === 'blank' && <p className={styles.message}>{nameIssueMessage(issue)}</p>}
      {issue?.kind === 'taken' && (
        <p role="alert" className={clsx(styles.problem, 'fade-in')}>
          {nameIssueMessage(issue)}
        </p>
      )}
      {editor.error && (
        <p role="alert" className={clsx(styles.problem, 'fade-in')}>
          {errorMessage(editor.error)}
        </p>
      )}
      <div className={styles.actions}>
        {status && (
          <div className={styles.deleteGroup}>
            <Button
              variant="text"
              tone="danger"
              icon={Trash2}
              disabled={!deletable}
              onClick={onDelete}
            >
              Delete status
            </Button>
            {!deletable && <span className={styles.deleteHint}>{LAST_STATUS_HINT}</span>}
          </div>
        )}
        <Button className={styles.choice} onClick={() => onDone(status?.id)}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className={styles.choice}
          disabled={issue !== null || editor.pending}
        >
          Save status
        </Button>
      </div>
    </>
  );
}
