import { helperLabel, type Runner } from '@tracker/shared';
import type { DropdownOption } from '../../components';

export const helperOptions = (helpers: readonly Runner[]): DropdownOption[] =>
  helpers.map((helper) => ({
    value: helper.id,
    label: helperLabel(helper),
    title: helperLabel(helper),
  }));
