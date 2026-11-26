import type { ReactNode } from 'react';

export type SwipeTone = 'accent' | 'neutral' | 'dark' | 'danger';

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  tone: SwipeTone;
  onTrigger: () => void;
}
