import { describe, expect, it } from 'vitest';
import { listItem, STATUS, statuses } from '../../../api/test/fixtures';
import { buildColumns } from '../buildGroups';
import { boardDirection, boardMoveTarget } from './boardMoves';

// To do: MOB-1, MOB-2, MOB-3 · In progress: MOB-4 · Need review and Reviewed empty · Done: MOB-5
const columns = buildColumns({
  statuses,
  tickets: [
    listItem(1, STATUS.todo, 0),
    listItem(2, STATUS.todo, 1000),
    listItem(3, STATUS.todo, 2000),
    listItem(4, STATUS.progress, 0),
    listItem(5, STATUS.done, 0),
  ],
  filter: 'all',
  query: '',
});

describe('boardDirection', () => {
  it('maps the four arrow keys and nothing else', () => {
    expect(boardDirection('ArrowUp')).toBe('up');
    expect(boardDirection('ArrowDown')).toBe('down');
    expect(boardDirection('ArrowLeft')).toBe('left');
    expect(boardDirection('ArrowRight')).toBe('right');
    expect(boardDirection('Enter')).toBeNull();
  });
});

describe('boardMoveTarget', () => {
  it('moves one slot up or down within the column', () => {
    expect(boardMoveTarget(columns, 't-2', 'up')).toEqual({
      statusId: STATUS.todo,
      beforeId: 't-1',
      afterId: null,
    });
    expect(boardMoveTarget(columns, 't-2', 'down')).toEqual({
      statusId: STATUS.todo,
      beforeId: null,
      afterId: 't-3',
    });
  });

  it('stops at the top and bottom of the column', () => {
    expect(boardMoveTarget(columns, 't-1', 'up')).toBeNull();
    expect(boardMoveTarget(columns, 't-3', 'down')).toBeNull();
    expect(boardMoveTarget(columns, 't-4', 'down')).toBeNull();
  });

  it('moves into the same slot of the next or previous column', () => {
    expect(boardMoveTarget(columns, 't-1', 'right')).toEqual({
      statusId: STATUS.progress,
      beforeId: 't-4',
      afterId: null,
    });
    expect(boardMoveTarget(columns, 't-4', 'left')).toEqual({
      statusId: STATUS.todo,
      beforeId: 't-1',
      afterId: null,
    });
  });

  it('lands at the end of a shorter or empty column', () => {
    expect(boardMoveTarget(columns, 't-3', 'right')).toEqual({
      statusId: STATUS.progress,
      beforeId: null,
      afterId: 't-4',
    });
    expect(boardMoveTarget(columns, 't-4', 'right')).toEqual({
      statusId: STATUS.review,
      beforeId: null,
      afterId: null,
    });
  });

  it('has nowhere to go past the first or last column', () => {
    expect(boardMoveTarget(columns, 't-1', 'left')).toBeNull();
    expect(boardMoveTarget(columns, 't-5', 'right')).toBeNull();
  });

  it("stays in the one column a status's tab shows", () => {
    const reviewed = buildColumns({
      statuses,
      tickets: [listItem(1, STATUS.reviewed, 0)],
      filter: STATUS.reviewed,
      query: '',
    });
    expect(boardMoveTarget(reviewed, 't-1', 'right')).toBeNull();
    expect(boardMoveTarget(reviewed, 't-1', 'left')).toBeNull();
  });

  it('knows nothing about tickets the columns do not show', () => {
    expect(boardMoveTarget(columns, 't-404', 'up')).toBeNull();
  });
});
