import { describe, expect, it } from 'vitest';
import { ANSWERING, nextState, showsBanner, type TrackerState } from './trackerState';

const LOST: TrackerState = { answers: false, savedReads: false };
const SAVED: TrackerState = { answers: false, savedReads: true };
const SAVED_CHECKED: TrackerState = { answers: true, savedReads: true };

describe('nextState', () => {
  it('loses the tracker on a request or a check that gets no answer', () => {
    expect(nextState(ANSWERING, 'unreachable', false)).toEqual(LOST);
    expect(nextState(SAVED_CHECKED, 'unreachable', true)).toEqual(SAVED);
  });

  it('leaves it to a check to say the tracker answers after the first saved read', () => {
    expect(nextState(ANSWERING, 'saved', false)).toEqual(SAVED);
    expect(nextState(LOST, 'saved', false)).toEqual(SAVED);
  });

  it('changes nothing on a later saved read', () => {
    expect(nextState(SAVED_CHECKED, 'saved', false)).toBe(SAVED_CHECKED);
  });

  it('ends saved reads only with an answer to a read or a write', () => {
    expect(nextState(SAVED, 'reachable', true)).toEqual(SAVED_CHECKED);
    expect(nextState(SAVED_CHECKED, 'reachable', false)).toEqual(ANSWERING);
  });

  it('counts a check’s answer as the tracker back when no saved read came', () => {
    expect(nextState(LOST, 'reachable', true)).toEqual(ANSWERING);
  });
});

describe('showsBanner', () => {
  it('shows it while the tracker gives no answer or reads come from saved copies', () => {
    expect(showsBanner(ANSWERING)).toBe(false);
    expect(showsBanner(LOST)).toBe(true);
    expect(showsBanner(SAVED)).toBe(true);
    expect(showsBanner(SAVED_CHECKED)).toBe(true);
  });
});
