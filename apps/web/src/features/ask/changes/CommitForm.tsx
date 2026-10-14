import { isSecretPath, type ChatChangedFile } from '@tracker/shared';
import { AutoTextarea } from '../../../components';
import styles from './ChatChanges.module.css';
import type { CommitValues } from './commitValues';
import {
  BRANCH_LABEL,
  DIRTY_NOTE,
  FILES_LABEL,
  MESSAGE_LABEL,
  PICK_NOTE,
  SECRET_NOTE,
} from './copy';

export interface CommitFormProps {
  files: readonly ChatChangedFile[];
  values: CommitValues;
  onChange: (values: CommitValues) => void;
  error: string | null;
}

const toggled = (picks: ReadonlySet<string>, path: string, on: boolean) => {
  const next = new Set(picks);
  if (on) next.add(path);
  else next.delete(path);
  return next;
};

function fileNote(file: ChatChangedFile): string | null {
  if (file.dirtyBefore) return DIRTY_NOTE;
  return isSecretPath(file.path) ? SECRET_NOTE : null;
}

function FileChoice({
  file,
  values,
  onChange,
}: Omit<CommitFormProps, 'files' | 'error'> & { file: ChatChangedFile }) {
  const note = fileNote(file);
  return (
    <label className={styles.file}>
      <input
        type="checkbox"
        checked={values.picks.has(file.path)}
        onChange={(event) =>
          onChange({
            ...values,
            picks: toggled(values.picks, file.path, event.currentTarget.checked),
          })
        }
      />
      <span>{file.path}</span>
      {note && <span className={styles.fileNote}>{note}</span>}
    </label>
  );
}

export function CommitForm({ files, values, onChange, error }: CommitFormProps) {
  return (
    <div className={styles.body}>
      <label className={styles.field}>
        {MESSAGE_LABEL}
        <AutoTextarea
          className={styles.input}
          rows={2}
          value={values.message}
          onChange={(event) => onChange({ ...values, message: event.currentTarget.value })}
        />
      </label>
      <label className={styles.field}>
        {BRANCH_LABEL}
        <input
          className={styles.input}
          value={values.branch}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...values, branch: event.currentTarget.value })}
        />
      </label>
      <fieldset className={styles.files}>
        <legend>{FILES_LABEL}</legend>
        {files.map((file) => (
          <FileChoice key={file.path} file={file} values={values} onChange={onChange} />
        ))}
      </fieldset>
      {files.some((file) => fileNote(file)) && <p className={styles.summary}>{PICK_NOTE}</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
