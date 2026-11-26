import type { SessionHistory } from './sessionHistory';
import type { SwipeDirection } from './trackpadSwipe';

export interface HistorySteps {
  canStep: (direction: SwipeDirection) => boolean;
  step: (direction: SwipeDirection) => void;
}

export interface HistoryStepsInput {
  history: SessionHistory;
  // The session history starts empty on a reload, while the browser still holds the entries
  // before it.
  entryBehind: () => boolean;
  go: (delta: -1 | 1) => void;
  // A deep link has no entry behind it, so back still reaches the parent screen, as the Back
  // button does.
  backToParent: (() => void) | null;
}

export function historySteps(input: HistoryStepsInput): HistorySteps {
  const { history, entryBehind, go, backToParent } = input;
  const hasEntry = (direction: SwipeDirection) => {
    if (direction === 'forward') return history.nextPath() !== null;

    return history.previousPath() !== null || entryBehind();
  };

  return {
    canStep: (direction) => hasEntry(direction) || (direction === 'back' && backToParent !== null),
    step: (direction) => {
      if (hasEntry(direction)) go(direction === 'back' ? -1 : 1);
      else if (direction === 'back') backToParent?.();
    },
  };
}
