import {
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABELS,
  type Status,
  type StatusCategory,
} from '@tracker/shared';
import { StatusGlyph, type DropdownOption } from '../../components';

export const categoryOptions = (color: string): DropdownOption<StatusCategory>[] =>
  STATUS_CATEGORIES.map((category) => ({
    value: category,
    label: STATUS_CATEGORY_LABELS[category],
    icon: <StatusGlyph category={category} color={color} animated={false} />,
  }));

export const statusOptions = (statuses: readonly Status[]): DropdownOption[] =>
  statuses.map((status) => ({
    value: status.id,
    label: status.name,
    icon: <StatusGlyph category={status.category} color={status.color} animated={false} />,
  }));
