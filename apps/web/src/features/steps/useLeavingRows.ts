import { useCallback, useState } from 'react';
import { prefersReducedMotionNow } from '../../lib/media';
import { leavingRows } from './leavingRows';
import type { StepRow } from './stepRows';

const keyOf = (rows: StepRow[]): string => `${rows[0]?.seq ?? 0}-${rows.at(-1)?.seq ?? 0}`;

interface Shown {
  key: string;
  rows: StepRow[];
  leaving: StepRow[];
}

// Worked out while rendering, as React does for state that follows props, so the rows that leave
// are on the page in the same frame the new step comes in.
export function useLeavingRows(shown: StepRow[]) {
  const [state, setState] = useState<Shown>({ key: keyOf(shown), rows: shown, leaving: [] });
  const key = keyOf(shown);
  if (state.key !== key) {
    const left = prefersReducedMotionNow() ? [] : leavingRows(state.rows, shown);
    setState({ key, rows: shown, leaving: [...state.leaving, ...left] });
  }
  const onLeft = useCallback(
    (seq: number) =>
      setState((current) => ({
        ...current,
        leaving: current.leaving.filter((row) => row.seq !== seq),
      })),
    [],
  );
  return { leaving: state.leaving, onLeft };
}
