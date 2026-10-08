import { describe, expect, it } from 'vitest';
import { listItem, STATUS } from '../../../api/test/fixtures';
import { restorePoint, undoTarget } from './restorePoint';

const reviewed = (num: number, rank: number) => listItem(num, STATUS.reviewed, rank);
const done = (num: number, rank: number) => listItem(num, STATUS.done, rank);

describe('restorePoint', () => {
  it('remembers the status, the rank and the tickets just above and below', () => {
    const tickets = [reviewed(1, 0), reviewed(2, 1000), reviewed(3, 2000), done(4, 0)];
    expect(restorePoint(tickets, reviewed(2, 1000))).toEqual({
      statusId: STATUS.reviewed,
      rank: 1000,
      num: 2,
      aboveId: 't-1',
      belowId: 't-3',
    });
  });

  it('has no neighbour past either end of the group, and none without a board', () => {
    const tickets = [reviewed(1, 0), reviewed(2, 1000)];
    expect(restorePoint(tickets, reviewed(1, 0))).toMatchObject({ aboveId: null, belowId: 't-2' });
    expect(restorePoint(tickets, reviewed(2, 1000))).toMatchObject({
      aboveId: 't-1',
      belowId: null,
    });
    expect(restorePoint([], reviewed(2, 1000))).toMatchObject({ aboveId: null, belowId: null });
  });

  it('reads the ticket as it was, also from a board that already shows the move', () => {
    const shown = [reviewed(1, 0), done(2, -1000), reviewed(3, 2000)];
    expect(restorePoint(shown, reviewed(2, 1000))).toMatchObject({
      statusId: STATUS.reviewed,
      aboveId: 't-1',
      belowId: 't-3',
    });
  });

  it('places equal ranks like the list does, the newer ticket first', () => {
    const tickets = [reviewed(5, 0), reviewed(4, 0), reviewed(3, 0)];
    expect(restorePoint(tickets, reviewed(4, 0))).toMatchObject({ aboveId: 't-5', belowId: 't-3' });
  });
});

describe('undoTarget', () => {
  const point = restorePoint([reviewed(1, 0), reviewed(3, 2000)], reviewed(2, 1000));

  it('puts the ticket back above the ticket that was below it', () => {
    const now = [reviewed(7, -1000), reviewed(1, 0), reviewed(3, 2000), done(2, -1000)];
    expect(undoTarget(now, 't-2', point)).toEqual({ statusId: STATUS.reviewed, beforeId: 't-3' });
  });

  it('goes below the ticket that was above it once the one below has left', () => {
    const now = [reviewed(1, 0), reviewed(8, 1500), done(3, 0), done(2, -1000)];
    expect(undoTarget(now, 't-2', point)).toEqual({ statusId: STATUS.reviewed, afterId: 't-1' });
  });

  it('keeps its neighbours after a drag renumbered the group meanwhile', () => {
    const now = [reviewed(9, 0), reviewed(1, 1000), reviewed(3, 2000)];
    expect(undoTarget(now, 't-2', point)).toEqual({ statusId: STATUS.reviewed, beforeId: 't-3' });
  });

  it('finds its place by rank when both neighbours have left', () => {
    const now = [reviewed(7, -1000), reviewed(8, 1500), done(1, 0), done(3, 0)];
    expect(undoTarget(now, 't-2', point)).toEqual({ statusId: STATUS.reviewed, beforeId: 't-8' });
  });

  it('goes last when every ticket left sorts before it, and into an empty group', () => {
    const last = restorePoint([], reviewed(2, 1000));
    expect(undoTarget([reviewed(7, -1000)], 't-2', last)).toEqual({
      statusId: STATUS.reviewed,
      afterId: 't-7',
    });
    expect(undoTarget([done(2, 0)], 't-2', last)).toEqual({ statusId: STATUS.reviewed });
  });

  it('leaves the ticket itself out when it is still in the group', () => {
    const now = [reviewed(2, -1000), reviewed(1, 0), reviewed(3, 2000)];
    expect(undoTarget(now, 't-2', point)).toEqual({ statusId: STATUS.reviewed, beforeId: 't-3' });
  });
});
