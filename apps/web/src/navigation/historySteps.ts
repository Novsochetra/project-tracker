import type { SessionHistory } from './sessionHistory';
import type { SwipeDirection } from './trackpadSwipe';

export interface HistorySteps {
  canStep: (direction: SwipeDirection) => boolean;
  step: (direction: SwipeDirection) => void;
}

export interface HistoryStepsInput {
  history: SessionHistory;
  go: (delta: -1 | 1) => void;
  // A deep link has no entry behind it, so back still reaches the parent screen, as the Back
  // button does.
  backToParent: (() => void) | null;
}

export function historySteps({ history, go, backToParent }: HistoryStepsInput): HistorySteps {
  const hasEntry = (direction: SwipeDirection) => {
    const path = direction === 'back' ? history.previousPath() : history.nextPath();
    return path !== null;
  };
  return {
    canStep: (direction) => hasEntry(direction) || (direction === 'back' && backToParent !== null),
    step: (direction) => {
      if (hasEntry(direction)) go(direction === 'back' ? -1 : 1);
      else if (direction === 'back') backToParent?.();
    },
  };
}
