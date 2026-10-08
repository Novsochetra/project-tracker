import { AutoTextarea, type AutoTextareaProps } from '../../../components';
import { useAutosave } from './useAutosave';
import { useFieldDraft } from './useFieldDraft';

export interface AutosaveTextareaProps extends Omit<
  AutoTextareaProps,
  'value' | 'onChange' | 'onFocus' | 'onBlur' | 'variant'
> {
  /** The saved value; edits are kept locally and saved while typing and on blur. */
  value: string;
  onSave: (value: string) => void;
}

export function AutosaveTextarea({ value, onSave, ...rest }: AutosaveTextareaProps) {
  const draft = useFieldDraft(value);
  const autosave = useAutosave(onSave);
  return (
    <AutoTextarea
      variant="inline"
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
  );
}
