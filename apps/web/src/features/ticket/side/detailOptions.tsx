import {
  PRIORITIES,
  PRIORITY_LABELS,
  sortStatuses,
  type Priority,
  type Status,
} from '@tracker/shared';
import { PriorityBars, StatusGlyph, type DropdownOption } from '../../../components';

export const statusOptions = (statuses: readonly Status[]): DropdownOption[] =>
  sortStatuses(statuses).map((status) => ({
    value: status.id,
    label: status.name,
    icon: <StatusGlyph category={status.category} color={status.color} />,
  }));

export const PRIORITY_OPTIONS: readonly DropdownOption<Priority>[] = PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
  icon: <PriorityBars priority={priority} />,
}));
