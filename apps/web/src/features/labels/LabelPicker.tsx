import { LABEL_NAME_MAX, type Label } from '@tracker/shared';
import clsx from 'clsx';
import { Check, Pencil, Plus } from 'lucide-react';
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { Icon } from '../../components';
import { SearchField } from '../../components/SearchField';
import { LabelDot } from './LabelDot';
import { canAdd, LIMIT_MESSAGE } from './pickerLogic';
import styles from './LabelPicker.module.css';
import { useLabelPicker, type LabelPickerInput } from './useLabelPicker';

export type LabelPickerLayout = 'list' | 'chips';

export interface LabelPickerProps extends LabelPickerInput {
  layout: LabelPickerLayout;
  focusField?: boolean;
  // Renaming, recoloring and deleting stay in the Labels sheet; the picker only links to it.
  onManage?: (() => void) | undefined;
}

export const PICKER_FIELD_LABEL = 'Find or create a label';

// One picker for the desktop menu (a list) and the phone sheet (chips a thumb can hit): type to
// narrow the labels, or to make a new one, like a release's "v1.4", and put it on the ticket.
export function LabelPicker({ layout, focusField = false, onManage, ...input }: LabelPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const picker = useLabelPicker(input, rootRef);
  useLayoutEffect(() => {
    if (focusField) fieldRef.current?.focus({ preventScroll: true });
  }, [focusField]);
  const empty = input.labels.length === 0 && !picker.query.trim();
  return (
    <div ref={rootRef} className={clsx(styles.picker, styles[layout])}>
      <div className={styles.fieldRow}>
        <SearchField
          ref={fieldRef}
          aria-label={PICKER_FIELD_LABEL}
          placeholder={empty ? 'New label, like v1.4' : 'Find or create…'}
          enterKeyHint="done"
          maxLength={LABEL_NAME_MAX}
          className={styles.field}
          value={picker.query}
          data-picker-item=""
          onKeyDown={picker.onKeyDown}
          onChange={(event) => picker.setQuery(event.currentTarget.value)}
        />
      </div>
      {picker.matches.length > 0 && (
        <div
          role="listbox"
          aria-label="Labels"
          aria-multiselectable="true"
          className={styles.options}
        >
          {picker.matches.map((label) => (
            <LabelOption
              key={label.id}
              label={label}
              selected={input.value.includes(label.id)}
              disabled={!canAdd(input.value, label.id)}
              onToggle={() => picker.toggle(label.id)}
              onKeyDown={picker.onKeyDown}
            />
          ))}
        </div>
      )}
      {picker.newName && (
        <button
          type="button"
          tabIndex={-1}
          data-picker-item=""
          className={clsx('ring-inside', styles.create)}
          disabled={picker.creating}
          onKeyDown={picker.onKeyDown}
          onClick={() => void picker.addNew(picker.newName ?? '')}
        >
          <Icon icon={Plus} size={16} />
          <span className={styles.createName}>Create “{picker.newName}”</span>
        </button>
      )}
      {empty && <p className={styles.note}>No labels yet. Type a name to make the first one.</p>}
      {picker.full && <p className={styles.note}>{LIMIT_MESSAGE}</p>}
      {onManage && input.labels.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          data-picker-item=""
          className={clsx('ring-inside', styles.manage)}
          onKeyDown={picker.onKeyDown}
          onClick={onManage}
        >
          <Icon icon={Pencil} size={14} />
          Edit labels
        </button>
      )}
    </div>
  );
}

interface LabelOptionProps {
  label: Label;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function LabelOption({ label, selected, disabled, onToggle, onKeyDown }: LabelOptionProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      data-picker-item=""
      className={clsx('ring-inside', styles.option)}
      onClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <LabelDot color={label.color} />
      <span className={styles.name}>{label.name}</span>
      {selected && <Icon icon={Check} size={16} className={styles.check} />}
    </button>
  );
}
