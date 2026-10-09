import { describeCounts } from './summary';
import type { TargetState } from './targetState';

export const ALLOW_EXISTING_FLAG = '--allow-existing';

// Rows with the same ids mean this data is there already (a move that finished before); inserting
// them again could only fail. Other data is kept and the move adds to it, but only when asked.
export function targetProblems(state: TargetState, allowExisting: boolean): string[] {
  const same = describeCounts(state.sameIds);
  if (same) {
    return [
      `The target already has ${same} with the same ids as this data: it was moved there ` +
        'before. Nothing needs to be moved again.',
    ];
  }
  if (state.sameKeys.length > 0) {
    return [
      `The target already has a project with the key ${state.sameKeys.join(', ')}, and keys are ` +
        'unique. Delete that project in the online tracker first.',
    ];
  }
  const { projects, tickets } = state.existing;
  if (allowExisting || projects + tickets === 0) return [];
  return [
    `The target already holds ${describeCounts(state.existing)}. Moving adds this data next to ` +
      `it; run again with ${ALLOW_EXISTING_FLAG} if that is what you want.`,
  ];
}
