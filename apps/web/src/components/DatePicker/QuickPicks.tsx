import { MenuItem } from '../Popover';
import { addDays, fullDateLabel, nextMonday, shortWeekday, type Ymd } from './calendar';
import styles from './DatePicker.module.css';

export interface QuickPicksProps {
  value: string;
  today: Ymd;
  onPick: (day: string) => void;
}

export function QuickPicks({ value, today, onPick }: QuickPicksProps) {
  const picks = [
    { label: 'Today', day: today },
    { label: 'Tomorrow', day: addDays(today, 1) },
    { label: 'Next week', day: nextMonday(today) },
  ];
  return (
    <div className={styles.quick}>
      {picks.map(({ label, day }) => (
        <MenuItem
          key={label}
          aria-label={`${label}, ${fullDateLabel(day)}`}
          className={styles.quickItem}
          onClick={() => onPick(day)}
        >
          {label}
          <span className={styles.hint}>{shortWeekday(day)}</span>
        </MenuItem>
      ))}
      {value && (
        <>
          <span className={styles.separator} />
          <MenuItem className={styles.quickItem} onClick={() => onPick('')}>
            Clear
          </MenuItem>
        </>
      )}
    </div>
  );
}
