import { useId } from 'react';
import { AutoTextarea, type AutoTextareaProps } from '../../../components';
import { FieldNote } from './FieldNote';
import { useAutosave } from './useAutosave';
import { useFieldDraft } from './useFieldDraft';
import type { FieldSave, FieldTarget } from './useFieldSave';

export interface AutosaveTextareaProps extends Omit<
  AutoTextareaProps,
  'value' | 'onChange' | 'onFocus' | 'onBlur' | 'variant' | 'aria-label'
> {
  // Names the field, and what isn't saved when a save fails.
  label: string;
  // Where unsaved text is kept (drafts store), such as the title of MOB-3.
  target: FieldTarget;
  // The saved value; edits are kept locally and saved while typing and on blur.
  value: string;
  onSave: FieldSave;
}

export function AutosaveTextarea({ label, target, value, onSave, ...rest }: AutosaveTextareaProps) {
  const draft = useFieldDraft(value, target, onSave);
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
          // Once a save has failed, only a retry that checks the tracker first saves again.
          if (!draft.failed) autosave.schedule(event.currentTarget.value);
        }}
        onFocus={draft.focus}
        onBlur={() => {
          draft.blur();
          if (draft.failed) {
            draft.retry();
            return;
          }
          // What was typed is what the field shows, so it is saved even if the server moved on
          // after the last autosave; an untouched field catches up with the server instead.
          if (draft.edited) autosave.commit(draft.value);
        }}
      />
      <FieldNote draft={draft} subject={label} id={noteId} />
    </>
  );
}
