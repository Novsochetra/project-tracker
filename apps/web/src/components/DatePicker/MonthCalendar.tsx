import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { IconButton } from '../IconButton';
import {
  addMonths,
  dayNumber,
  fullDateLabel,
  isYmd,
  monthGrid,
  monthLabel,
  monthOf,
  weekdayColumns,
  type Ymd,
} from './calendar';
import { dayForKey } from './calendarKeys';
import styles from './DatePicker.module.css';
import { localeWeekStart } from './weekStart';

export interface MonthCalendarProps {
  value: string;
  today: Ymd;
  onPick: (day: Ymd) => void;
}

interface DayButtonProps extends MonthCalendarProps {
  day: Ymd;
  focusDay: Ymd;
}

function DayButton({ day, focusDay, value, today, onPick }: DayButtonProps) {
  const chosen = day === value;
  return (
    <button
      type="button"
      data-day={day}
      tabIndex={day === focusDay ? 0 : -1}
      aria-label={fullDateLabel(day)}
      aria-pressed={chosen}
      aria-current={day === today ? 'date' : undefined}
      className={clsx(
        styles.day,
        monthOf(day) !== monthOf(focusDay) && styles.outside,
        day === today && styles.today,
        chosen && styles.chosen,
      )}
      onClick={() => onPick(day)}
    >
      {dayNumber(day)}
    </button>
  );
}

// The focused day sets the month on show, so the arrows and Page Up/Down turn the months too.
export function MonthCalendar(props: MonthCalendarProps) {
  const { value, today } = props;
  const weekStart = useMemo(() => localeWeekStart(navigator.language), []);
  const [focusDay, setFocusDay] = useState(() => (isYmd(value) ? value : today));
  const focusPending = useRef(true);
  const gridRef = useRef<HTMLTableElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const button = gridRef.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`);
    button?.focus({ preventScroll: true });
  }, [focusDay]);

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const next = dayForKey(event, focusDay, weekStart);
    if (!next) return;
    event.preventDefault();
    focusPending.current = true;
    setFocusDay(next);
  };
  const turn = (months: number) => setFocusDay((day) => addMonths(day, months));

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title} aria-live="polite">
          {monthLabel(focusDay)}
        </h2>
        <IconButton
          size="sm"
          icon={ChevronLeft}
          aria-label="Previous month"
          onClick={() => turn(-1)}
        />
        <IconButton size="sm" icon={ChevronRight} aria-label="Next month" onClick={() => turn(1)} />
      </div>
      <table
        ref={gridRef}
        role="grid"
        tabIndex={-1}
        aria-labelledby={titleId}
        className={styles.grid}
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {weekdayColumns(weekStart).map((column) => (
              <th key={column.name} scope="col" aria-label={column.name} className={styles.weekday}>
                {column.initial}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(focusDay, weekStart).map((week) => (
            <tr key={week[0]}>
              {week.map((day) => (
                <td key={day} className={styles.cell}>
                  <DayButton {...props} day={day} focusDay={focusDay} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
