import { useMediaQuery } from '../../lib/media';

// Phones and touch screens keep the native picker, which iOS does well. Desktop browsers draw their
// own plain popup that ignores the app's design, so a mouse on a wide screen gets the calendar.
export const CALENDAR_QUERY = '(min-width: 768px) and (pointer: fine)';

export const useCalendarPicker = (): boolean => useMediaQuery(CALENDAR_QUERY);
