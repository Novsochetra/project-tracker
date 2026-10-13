import type { ApiSignal } from './offline';

export interface TrackerState {
  answers: boolean;
  savedReads: boolean;
}

export const ANSWERING: TrackerState = { answers: true, savedReads: false };

// /api/health, which the service worker leaves to the network, can answer while reads get saved
// copies, as when the worker still gave a read 3 s. A check's answer that ended saved reads took
// the banner down and read the project list again, whose saved answer put it back, every 4 s
// (PT-126), so only a read's or a write's answer ends them.
export function nextState(
  state: TrackerState,
  signal: Exclude<ApiSignal, 'unsure'>,
  fromCheck: boolean,
): TrackerState {
  if (signal === 'unreachable') return { ...state, answers: false };
  if (signal === 'reachable') return fromCheck ? { ...state, answers: true } : ANSWERING;
  // The first saved read leaves it to the next check to say the tracker answers, and that answer
  // reads the project list, which clears the banner when reads are quick again. Later ones say
  // nothing new: each would make the next check's answer read the list again, in a loop.
  return state.savedReads ? state : { answers: false, savedReads: true };
}

export const showsBanner = (state: TrackerState): boolean => !state.answers || state.savedReads;
