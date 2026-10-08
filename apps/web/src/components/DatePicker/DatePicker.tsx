import { todayYmd } from '@tracker/shared';
import { useCallback, useRef, useState, type RefObject } from 'react';
import { FloatingPanel, FloatingPortal, placeFloating, type PlaceFloating } from '../FloatingPanel';
import styles from './DatePicker.module.css';
import { useDialogKeys } from './dialogKeys';
import { MonthCalendar } from './MonthCalendar';
import { QuickPicks } from './QuickPicks';

export interface DatePickerProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  value: string;
  label: string;
  onPick: (value: string) => void;
  onClose: () => void;
}

export function DatePicker(props: DatePickerProps) {
  return (
    <FloatingPortal open={props.open}>
      <DatePickerPanel {...props} />
    </FloatingPortal>
  );
}

const placeCalendar: PlaceFloating = (anchor, panel) =>
  placeFloating({
    anchor,
    size: { width: panel.offsetWidth, height: panel.offsetHeight },
    viewport: {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    },
  });

function DatePickerPanel({ open, anchorRef, value, label, onPick, onClose }: DatePickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [today] = useState(() => todayYmd());
  const close = useCallback(() => {
    anchorRef.current?.focus({ preventScroll: true });
    onClose();
  }, [anchorRef, onClose]);
  useDialogKeys(panelRef, close);
  const pick = (day: string) => {
    onPick(day);
    close();
  };
  return (
    <FloatingPanel
      open={open}
      anchorRef={anchorRef}
      panelRef={panelRef}
      closeLabel="Close calendar"
      place={placeCalendar}
      onClose={close}
      role="dialog"
      aria-modal="true"
      aria-label={`Choose ${label.toLowerCase()}`}
      className={styles.popover}
    >
      <MonthCalendar value={value} today={today} onPick={pick} />
      <QuickPicks value={value} today={today} onPick={pick} />
    </FloatingPanel>
  );
}
