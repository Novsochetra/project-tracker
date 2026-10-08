import { useId } from 'react';
import { AutoTextarea, type AutoTextareaProps } from '../../../components';
import { UnsavedNote } from './UnsavedNote';
import { useAutosave } from './useAutosave';
import { useFieldDraft, type FieldSave } from './useFieldDraft';

export interface AutosaveTextareaProps extends Omit<
  AutoTextareaProps,
  'value' | 'onChange' | 'onFocus' | 'onBlur' | 'variant' | 'aria-label'
> {
  /** Names the field, and what isn't saved when a save fails. */
  label: string;
  /** Names the unsaved text for the drafts contract, such as "title:MOB-3". */
  draftId: string;
  /** The saved value; edits are kept locally and saved while typing and on blur. */
  value: string;
  onSave: FieldSave;
}

export function AutosaveTextarea({
  label,
  draftId,
  value,
  onSave,
  ...rest
}: AutosaveTextareaProps) {
  const draft = useFieldDraft(value, draftId, onSave);
  const autosave = useAutosave(draft.save);
  const noteId = useId();
  return (
    <>
      <AutoTextarea
        variant="inline"
        aria-label={label}
        aria-describedby={draft.failed ? noteId : undefined}
        {...rest}
        value={draft.value}
        onChange={(event) => {
          draft.change(event.currentTarget.value);
          autosave.schedule(event.currentTarget.value);
        }}
        onFocus={draft.focus}
        onBlur={() => {
          draft.blur();
          // What was typed is what the field shows, so it is saved even if the server moved on
          // after the last autosave; an untouched field catches up with the server instead.
          if (draft.edited) autosave.commit(draft.value);
        }}
      />
      {draft.failed && <UnsavedNote id={noteId} subject={label} onRetry={draft.retry} />}
    </>
  );
}
