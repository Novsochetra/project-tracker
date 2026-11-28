import clsx from 'clsx';
import { Check, Pencil, Plus } from 'lucide-react';
import { useLayoutEffect, type MouseEvent, type PointerEvent } from 'react';
import { Icon } from '../../components';
import { LabelDot } from './LabelDot';
import styles from './LabelPicker.module.css';
import { canAdd } from './pickerLogic';
import { optionId, type ActiveItem, type ActiveSource, type PickerItem } from './pickerItems';

export interface LabelPickerListProps {
  id: string;
  items: readonly PickerItem[];
  value: readonly string[];
  active: ActiveItem | null;
  creating: boolean;
  onActivate: (item: PickerItem) => void;
  onPoint: (key: string | null) => void;
}

// The labels, then Create and Edit labels apart under a hairline, as a menu groups its actions.
export function LabelPickerList({ id, items, active, onPoint, ...rows }: LabelPickerListProps) {
  useLayoutEffect(() => {
    if (active?.by !== 'keyboard') return;

    document.getElementById(optionId(id, active.key))?.scrollIntoView?.({ block: 'nearest' });
  }, [id, active]);

  const row = (item: PickerItem) => (
    <PickerRow
      key={item.key}
      id={optionId(id, item.key)}
      item={item}
      activeBy={active?.key === item.key ? active.by : undefined}
      onPoint={onPoint}
      {...rows}
    />
  );
  const labels = items.filter((item) => item.kind === 'label');
  const actions = items.filter((item) => item.kind !== 'label');

  return (
    <div
      role="listbox"
      id={id}
      aria-label="Labels"
      aria-multiselectable="true"
      className={styles.rows}
      onPointerLeave={() => onPoint(null)}
    >
      {labels.length > 0 && <div className={styles.options}>{labels.map(row)}</div>}
      {actions.length > 0 && <div className={styles.actions}>{actions.map(row)}</div>}
    </div>
  );
}

interface PickerRowProps extends Omit<LabelPickerListProps, 'id' | 'items' | 'active'> {
  id: string;
  item: PickerItem;
  activeBy: ActiveSource | undefined;
}

// Focus stays in the field, so typing goes on after a pick, and a phone's keyboard stays down.
const keepFocus = (event: MouseEvent) => event.preventDefault();

function PickerRow({ id, item, activeBy, value, creating, onActivate, onPoint }: PickerRowProps) {
  const selected = item.kind === 'label' && value.includes(item.label.id);
  const disabled =
    (item.kind === 'label' && !canAdd(value, item.label.id)) ||
    (item.kind === 'create' && creating);
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') onPoint(item.key);
  };

  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={item.kind === 'label' ? selected : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      data-active={activeBy}
      className={clsx('ring-inside', styles.option, styles[item.kind])}
      onMouseDown={keepFocus}
      onPointerMove={onPointerMove}
      onClick={() => onActivate(item)}
    >
      <RowContent item={item} selected={selected} />
    </button>
  );
}

function RowContent({ item, selected }: { item: PickerItem; selected: boolean }) {
  if (item.kind === 'create') {
    return (
      <>
        <Icon icon={Plus} className={styles.lead} />
        <span className={styles.name}>Create “{item.name}”</span>
      </>
    );
  }

  if (item.kind === 'manage') {
    return (
      <>
        <Icon icon={Pencil} size={14} className={styles.lead} />
        <span className={styles.name}>Edit labels</span>
      </>
    );
  }

  return (
    <>
      <span className={styles.lead}>
        <LabelDot color={item.label.color} />
      </span>
      <span className={styles.name}>{item.label.name}</span>
      {selected && <Icon icon={Check} className={styles.check} />}
    </>
  );
}
