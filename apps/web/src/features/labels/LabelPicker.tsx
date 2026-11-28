import { LABEL_NAME_MAX } from '@tracker/shared';
import clsx from 'clsx';
import { Tag } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { Icon } from '../../components';
import { SearchField } from '../../components/SearchField';
import { LabelPickerList } from './LabelPickerList';
import { optionId } from './pickerItems';
import { LIMIT_MESSAGE } from './pickerLogic';
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
// narrow the labels, or to make a new one, like a release's "v1.4", and put it on the ticket. The
// field is a combobox that keeps focus while the arrows move through the rows below it.
export function LabelPicker({ layout, focusField = false, onManage, ...input }: LabelPickerProps) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const picker = useLabelPicker(input, onManage);
  useLayoutEffect(() => {
    if (focusField) fieldRef.current?.focus({ preventScroll: true });
  }, [focusField]);

  const empty = input.labels.length === 0 && !picker.query.trim();
  const listed = picker.items.length > 0;
  const matched = picker.items.some((item) => item.kind !== 'manage');
  const activeId = picker.active ? optionId(listId, picker.active.key) : undefined;

  return (
    <div className={clsx(styles.picker, styles[layout])}>
      <SearchField
        ref={fieldRef}
        role="combobox"
        aria-label={PICKER_FIELD_LABEL}
        aria-autocomplete="list"
        aria-expanded={listed}
        aria-controls={listed ? listId : undefined}
        aria-activedescendant={activeId}
        placeholder={empty ? 'New label, like v1.4' : 'Find or create…'}
        enterKeyHint="done"
        maxLength={LABEL_NAME_MAX}
        filled
        className={styles.field}
        value={picker.query}
        onKeyDown={picker.onKeyDown}
        onChange={(event) => picker.setQuery(event.currentTarget.value)}
        onClear={() => picker.setQuery('')}
      />
      {picker.full && <p className={styles.note}>{LIMIT_MESSAGE}</p>}
      {!empty && !matched && <p className={styles.note}>No labels match.</p>}
      {listed && (
        <LabelPickerList
          id={listId}
          items={picker.items}
          value={input.value}
          active={picker.active}
          creating={picker.creating}
          onActivate={picker.activate}
          onPoint={picker.point}
        />
      )}
      {empty && <NoLabels />}
    </div>
  );
}

// Laid out like iOS's empty states: a symbol, a title and a line of help. In the flow under the
// field, never in a scroller under it, so it can't be cut (PT-286).
function NoLabels() {
  return (
    <div className={styles.empty}>
      <Icon icon={Tag} size={20} className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>No labels yet</p>
      <p className={styles.emptyText}>Type a name to make the first one.</p>
    </div>
  );
}
