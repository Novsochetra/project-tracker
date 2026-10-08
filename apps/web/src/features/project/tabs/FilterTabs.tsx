import type { FilterTab, TicketFilter } from '@tracker/shared';
import clsx from 'clsx';
import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { StatusGlyph } from '../../../components';
import styles from './FilterTabs.module.css';
import { revealTab, tabButtons, tabScrollBehavior } from './revealTab';
import { tabIndexForKey } from './tabKeys';
import { useRevealPressed } from './useRevealPressed';
import { useTabThumb } from './useTabThumb';
import { useWheelScrollsRow } from './wheelRow';

export interface FilterTabsProps {
  tabs: readonly FilterTab[];
  value: TicketFilter;
  onChange: (value: TicketFilter) => void;
  className?: string | undefined;
}

interface TabButtonProps {
  tab: FilterTab;
  pressed: boolean;
  tabbable: boolean;
  onPick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus: () => void;
  onBlur: (event: FocusEvent<HTMLButtonElement>) => void;
}

function TabButton({ tab, pressed, tabbable, onPick, ...handlers }: TabButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      tabIndex={tabbable ? 0 : -1}
      className={styles.tab}
      onClick={onPick}
      {...handlers}
    >
      {tab.status && (
        <StatusGlyph category={tab.status.category} color={tab.status.color} animated={false} />
      )}
      <span className={styles.name}>{tab.status?.name ?? 'All'}</span>{' '}
      <span className={styles.count}>
        {tab.count}{' '}
        <span className="visually-hidden">{tab.count === 1 ? 'ticket' : 'tickets'}</span>
      </span>
    </button>
  );
}

// A toolbar, so screen readers say the arrow keys move between the tabs. They only move focus:
// each pick refilters the list and replays its rise, so it waits for Enter or Space.
export function FilterTabs({ tabs, value, onChange, className }: FilterTabsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState<TicketFilter | null>(null);
  useTabThumb(trackRef, thumbRef, tabs.map((tab) => tab.value).join(' '));
  useRevealPressed(trackRef, value);
  useWheelScrollsRow(trackRef);
  const stop = tabs.some((tab) => tab.value === focused) ? focused : value;

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const track = trackRef.current;
    const next = tabIndexForKey(event.key, index, tabs.length);
    const target = track && next !== null ? tabButtons(track)[next] : undefined;
    if (!track || !target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    revealTab(track, target, tabScrollBehavior());
  };
  const leaveRow = (event: FocusEvent<HTMLButtonElement>) => {
    if (!trackRef.current?.contains(event.relatedTarget)) setFocused(null);
  };

  return (
    <div
      ref={trackRef}
      role="toolbar"
      aria-label="Filter tickets"
      className={clsx(styles.track, className)}
    >
      <span ref={thumbRef} className={styles.thumb} data-thumb="" aria-hidden="true" />
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.value}
          tab={tab}
          pressed={tab.value === value}
          tabbable={tab.value === stop}
          onPick={() => onChange(tab.value)}
          onKeyDown={(event) => moveFocus(event, index)}
          onFocus={() => setFocused(tab.value)}
          onBlur={leaveRow}
        />
      ))}
    </div>
  );
}
