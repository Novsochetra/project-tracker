import { LABEL_INSTRUCTIONS_MAX, LABEL_NAME_MAX, LABEL_TEMPLATE_MAX } from '@tracker/shared';
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
import { Button } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { isPhoneNow } from '../../lib/media';
import { ColorSwatches } from '../statuses/ColorSwatches';
import styles from '../statuses/StatusEditor.module.css';
import { useEscapeKey } from '../statuses/useEscapeKey';
import { DeleteLabel } from './DeleteLabel';
import { LabelDot } from './LabelDot';
import { nameIssueMessage } from './labelForm';
import { LabelTextField } from './LabelTextField';
import { useLabelEditor, type LabelEditorState, type LabelEditorTarget } from './useLabelEditor';

export interface LabelEditorProps extends LabelEditorTarget {
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

export function LabelEditor(props: LabelEditorProps) {
  const { label, onDone } = props;
  const editor = useLabelEditor(props);
  useNotifyDirty(editor.dirty, props.onDirtyChange);
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Phones keep the keyboard down until the person taps the name.
    const target = isPhoneNow() ? formRef.current : nameRef.current;
    target?.focus({ preventScroll: true });
  }, []);
  useEscapeKey(formRef, () => onDone(label?.id));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    editor.save();
  };
  // As in the status editor: the shorter confirm moves Add label under the finger.
  const askDelete = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    setDeleting(true);
  };
  return (
    <form
      ref={formRef}
      tabIndex={-1}
      aria-label={label ? `Edit ${label.name}` : 'New label'}
      className={clsx(styles.editor, 'fade-in')}
      onSubmit={submit}
      noValidate
    >
      {deleting && label ? (
        <DeleteLabel
          {...props}
          label={label}
          onCancel={() => setDeleting(false)}
          onDeleted={() => props.onDeleted(label.id)}
        />
      ) : (
        <EditorFields {...props} editor={editor} nameRef={nameRef} onDelete={askDelete} />
      )}
    </form>
  );
}

interface EditorFieldsProps extends LabelEditorProps {
  editor: LabelEditorState;
  nameRef: RefObject<HTMLInputElement | null>;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}

function EditorFields({ editor, nameRef, label, onDone, onDelete }: EditorFieldsProps) {
  const { draft, change, issue } = editor;
  return (
    <>
      <div className={styles.nameRow}>
        <LabelDot color={draft.color} large />
        <input
          ref={nameRef}
          className={styles.nameInput}
          aria-label="Label name"
          placeholder="Label name"
          maxLength={LABEL_NAME_MAX}
          autoComplete="off"
          value={draft.name}
          onChange={(event) => change({ name: event.target.value })}
        />
      </div>
      <ColorSwatches value={draft.color} onChange={(color) => change({ color })} />
      <LabelTextField
        label="Template"
        hint="Fills an empty description when the label is picked for a new ticket."
        placeholder="## Steps to reproduce"
        maxLength={LABEL_TEMPLATE_MAX}
        value={draft.template}
        onChange={(template) => change({ template })}
      />
      <LabelTextField
        label="Instructions for Claude"
        hint="Claude gets these with every ticket that has this label, after the project’s."
        placeholder="What to do or check on these tickets."
        maxLength={LABEL_INSTRUCTIONS_MAX}
        value={draft.instructions}
        onChange={(instructions) => change({ instructions })}
      />
      <EditorProblems editor={editor} />
      <div className={styles.actions}>
        {label && (
          <div className={styles.deleteGroup}>
            <Button variant="text" tone="danger" icon={Trash2} onClick={onDelete}>
              Delete label
            </Button>
          </div>
        )}
        <Button className={styles.choice} onClick={() => onDone(label?.id)}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className={styles.choice}
          disabled={issue !== null || editor.pending}
        >
          Save label
        </Button>
      </div>
    </>
  );
}

function EditorProblems({ editor: { issue, error } }: { editor: LabelEditorState }) {
  return (
    <>
      {issue?.kind === 'blank' && <p className={styles.message}>{nameIssueMessage(issue)}</p>}
      {issue?.kind === 'taken' && (
        <p role="alert" className={clsx(styles.problem, 'fade-in')}>
          {nameIssueMessage(issue)}
        </p>
      )}
      {error && (
        <p role="alert" className={clsx(styles.problem, 'fade-in')}>
          {errorMessage(error)}
        </p>
      )}
    </>
  );
}
