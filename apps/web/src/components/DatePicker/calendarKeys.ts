import { addDays, addMonths, weekEndOf, weekStartOf, type Ymd } from './calendar';

export type CalendarKey = Pick<
  KeyboardEvent,
  'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
>;

// Modified keys stay with the browser and the system: Alt+← and ⌘← go back, for one.
const isModified = (event: CalendarKey): boolean =>
  event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

export function dayForKey(event: CalendarKey, day: Ymd, weekStart: number): Ymd | null {
  if (isModified(event)) return null;
  switch (event.key) {
    case 'ArrowLeft':
      return addDays(day, -1);
    case 'ArrowRight':
      return addDays(day, 1);
    case 'ArrowUp':
      return addDays(day, -7);
    case 'ArrowDown':
      return addDays(day, 7);
    case 'PageUp':
      return addMonths(day, -1);
    case 'PageDown':
      return addMonths(day, 1);
    case 'Home':
      return weekStartOf(day, weekStart);
    case 'End':
      return weekEndOf(day, weekStart);
    default:
      return null;
  }
}
