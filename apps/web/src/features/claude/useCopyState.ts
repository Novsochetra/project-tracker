import { useEffect, useState } from 'react';
import { COPIED_MS, type CopyOutcome } from './sendPrompt';

interface CopyState {
  outcome: CopyOutcome | null;
  attempt: number;
}

// Each copy restarts the 2s "Copied" label, so a second copy doesn't end it early.
export function useCopyState(): [CopyOutcome | null, (outcome: CopyOutcome) => void] {
  const [state, setState] = useState<CopyState>({ outcome: null, attempt: 0 });
  useEffect(() => {
    if (state.outcome !== 'copied') return;
    const timer = setTimeout(
      () => setState((current) => ({ ...current, outcome: null })),
      COPIED_MS,
    );
    return () => clearTimeout(timer);
  }, [state]);
  const report = (outcome: CopyOutcome) =>
    setState((current) => ({ outcome, attempt: current.attempt + 1 }));
  return [state.outcome, report];
}
