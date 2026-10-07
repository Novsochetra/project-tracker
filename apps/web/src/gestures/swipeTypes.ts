import type { ReactNode } from 'react';

export type SwipeTone = 'accent' | 'neutral' | 'danger';

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  tone: SwipeTone;
  onTrigger: () => void;
}
