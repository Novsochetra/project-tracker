export const PRIORITIES = ['high', 'medium', 'low'] as const;

export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
