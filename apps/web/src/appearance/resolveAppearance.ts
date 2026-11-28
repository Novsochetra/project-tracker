import type { AppearanceChoice } from './appearanceSetting';

export type Appearance = 'light' | 'dark';

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function resolveAppearance(choice: AppearanceChoice, systemDark: boolean): Appearance {
  if (choice !== 'system') return choice;

  return systemDark ? 'dark' : 'light';
}
