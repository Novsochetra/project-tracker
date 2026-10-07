import { describe, expect, it } from 'vitest';
import { makeBoard, STATUS, statuses } from '../test/fixtures';
import { reorderStatusList, upsertStatus, withStatuses } from './statuses';

describe('reorderStatusList', () => {
  it('gives each status its index as position and sorts by it', () => {
    const ids = [STATUS.done, STATUS.todo, STATUS.progress, STATUS.review, STATUS.reviewed];
    const reordered = reorderStatusList(statuses, ids);
    expect(reordered.map((status) => status.id)).toEqual(ids);
    expect(reordered.map((status) => status.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps statuses missing from the list after the listed ones', () => {
    const reordered = reorderStatusList(statuses, [STATUS.done]);
    expect(reordered[0]?.id).toBe(STATUS.done);
    expect(reordered.slice(1).map((status) => status.id)).toEqual([
      STATUS.todo,
      STATUS.progress,
      STATUS.review,
      STATUS.reviewed,
    ]);
  });
});

describe('upsertStatus', () => {
  it('replaces an existing status and appends a new one in position order', () => {
    const renamed = upsertStatus(statuses, { ...statuses[0]!, name: 'Backlog' });
    expect(renamed[0]?.name).toBe('Backlog');
    expect(renamed).toHaveLength(5);
    const added = upsertStatus(statuses, { ...statuses[0]!, id: 's-new', position: 9 });
    expect(added.at(-1)?.id).toBe('s-new');
  });

  it('updates the statuses of any cached project data', () => {
    const board = withStatuses(makeBoard(), (list) => list.slice(0, 2));
    expect(board.statuses).toHaveLength(2);
    expect(board.tickets).toHaveLength(4);
  });
});
