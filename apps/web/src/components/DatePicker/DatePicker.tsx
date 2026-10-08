import { todayYmd } from '@tracker/shared';
import { useCallback, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './DatePicker.module.css';
import { MonthCalendar } from './MonthCalendar';
import {
  useCloseOnScroll,
  useDialogKeys,
  usePickerPresence,
  usePopoverPlacement,
} from './popoverHooks';
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
  const { mounted, session } = usePickerPresence(props.open);
  if (!mounted) return null;
  return createPortal(<DatePickerPanel key={session} {...props} />, document.body);
}

function DatePickerPanel({ open, anchorRef, value, label, onPick, onClose }: DatePickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [today] = useState(() => todayYmd());
  const close = useCallback(() => {
    anchorRef.current?.focus({ preventScroll: true });
    onClose();
  }, [anchorRef, onClose]);
  usePopoverPlacement(panelRef, anchorRef);
  useDialogKeys(panelRef, close);
  useCloseOnScroll(panelRef, open, close);
  const pick = (day: string) => {
    onPick(day);
    close();
  };
  const leaving = !open;
  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close calendar"
          className={styles.catch}
          onClick={close}
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Choose ${label.toLowerCase()}`}
        aria-hidden={leaving || undefined}
        inert={leaving}
        tabIndex={-1}
        data-leaving={leaving || undefined}
        className={styles.popover}
      >
        <MonthCalendar value={value} today={today} onPick={pick} />
        <QuickPicks value={value} today={today} onPick={pick} />
      </div>
    </>
  );
}
