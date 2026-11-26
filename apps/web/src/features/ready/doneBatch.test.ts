import { DONE_MOVE_MAX, type Status } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { listItem, otherProject, project, STATUS, statuses } from '../../api/test/fixtures';
import {
  groupBatch,
  moveAllLabel,
  moveAllQuestion,
  movedBackMessage,
  movedMessage,
  readyBatch,
} from './doneBatch';
import { readyItems } from './readyItems';

const statusOf = (category: Status['category']): Status =>
  statuses.find((status) => status.category === category)!;

const webStatuses: Status[] = statuses.map((status) => ({
  ...status,
  id: `web-${status.id}`,
  projectId: otherProject.id,
  name: status.category === 'done' ? 'Shipped' : status.name,
}));

const mob = (num: number) => listItem(num, STATUS.reviewed, 0);
const web = (num: number) =>
  listItem(num, 'web-s-reviewed', 0, {
    id: `t-web-${num}`,
    projectId: otherProject.id,
    key: `WEB-${num}`,
  });

const ready = (tickets: ReturnType<typeof listItem>[], all = [...statuses, ...webStatuses]) =>
  readyItems({ tickets, statuses: all }, [project, otherProject]);

describe('readyBatch', () => {
  it('takes every ready ticket in the order listed, with the done name they share', () => {
    expect(readyBatch(ready([mob(3), mob(1)]))).toEqual({
      keys: ['MOB-3', 'MOB-1'],
      doneName: 'Done',
    });
    expect(readyBatch(ready([web(2), web(4)]))?.doneName).toBe('Shipped');
  });

  it("says Done when the projects' done statuses have other names", () => {
    expect(readyBatch(ready([web(2), mob(3)]))).toEqual({
      keys: ['WEB-2', 'MOB-3'],
      doneName: 'Done',
    });
  });

  it('leaves out a ticket whose project has no done status, and is nothing for fewer than two', () => {
    const noWebDone = [...statuses, ...webStatuses.filter(({ category }) => category !== 'done')];
    expect(readyBatch(ready([web(2), mob(3), mob(4)], noWebDone))?.keys).toEqual([
      'MOB-3',
      'MOB-4',
    ]);
    expect(readyBatch(ready([web(2), mob(3)], noWebDone))).toBeNull();
    expect(readyBatch(ready([mob(3)]))).toBeNull();
    expect(readyBatch([])).toBeNull();
  });

  it(`takes the first ${DONE_MOVE_MAX}, as many as one request moves`, () => {
    const many = Array.from({ length: DONE_MOVE_MAX + 3 }, (_, index) => mob(index + 1));
    const batch = readyBatch(ready(many));
    expect(batch?.keys).toHaveLength(DONE_MOVE_MAX);
    expect(batch?.keys.at(-1)).toBe(`MOB-${DONE_MOVE_MAX}`);
  });
});

describe('groupBatch', () => {
  const tickets = [mob(4), mob(2)];

  it("takes a reviewed group's tickets to the project's first done status", () => {
    const shipped = { ...statusOf('done'), id: 's-shipped', name: 'Shipped', position: 9 };
    expect(groupBatch(statusOf('reviewed'), tickets, [...statuses, shipped])).toEqual({
      keys: ['MOB-4', 'MOB-2'],
      doneName: 'Done',
    });
  });

  it('is nothing for another group, a project without Done or a single ticket', () => {
    expect(groupBatch(statusOf('in_review'), tickets, statuses)).toBeNull();
    const noDone = statuses.filter(({ category }) => category !== 'done');
    expect(groupBatch(statusOf('reviewed'), tickets, noDone)).toBeNull();
    expect(groupBatch(statusOf('reviewed'), [mob(4)], statuses)).toBeNull();
  });
});

describe('texts', () => {
  const batch = { keys: ['MOB-1', 'MOB-2', 'WEB-3'], doneName: 'Shipped' };

  it('counts the tickets asked about and names where they go', () => {
    expect(moveAllLabel(batch)).toBe('Move 3 to Shipped');
    expect(moveAllQuestion(batch)).toBe('Move all 3 tickets to Shipped?');
  });

  it('counts the tickets the tracker really moved, one as a ticket', () => {
    expect(movedMessage(3, 'Shipped')).toBe('3 tickets moved to Shipped');
    expect(movedMessage(1, 'Done')).toBe('1 ticket moved to Done');
    expect(movedMessage(0, 'Done')).toBe('0 tickets moved to Done');
    expect(movedBackMessage(2)).toBe('2 tickets moved back');
    expect(movedBackMessage(1)).toBe('1 ticket moved back');
  });
});
