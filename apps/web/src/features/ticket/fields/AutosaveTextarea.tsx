import { useId } from 'react';
import { AutoTextarea, type AutoTextareaProps } from '../../../components';
import { FieldNote } from './FieldNote';
import { useAutosave } from './useAutosave';
import { useFieldDraft } from './useFieldDraft';
import type { FieldTarget } from './useFieldSave';

export interface AutosaveTextareaProps extends Omit<
  AutoTextareaProps,
  'value' | 'onChange' | 'onBlur' | 'variant' | 'aria-label'
> {
  label: string;
  target: FieldTarget;
  // The saved value; edits stay local until they are saved.
  value: string;
}

export function AutosaveTextarea({
  label,
  target,
  value,
  onFocus,
  ...rest
}: AutosaveTextareaProps) {
  const draft = useFieldDraft(value, target);
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
        onFocus={(event) => {
          draft.focus();
          onFocus?.(event);
        }}
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
