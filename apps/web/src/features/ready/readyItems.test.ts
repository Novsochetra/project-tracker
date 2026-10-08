import { describe, expect, it } from 'vitest';
import { listItem, otherProject, project, STATUS } from '../../api/test/fixtures';
import { readyCounts, readyItems } from './readyItems';

const mob = (num: number) => listItem(num, STATUS.reviewed, 0);
const web = (num: number) =>
  listItem(num, 'web-reviewed', 0, { id: `t-web-${num}`, projectId: otherProject.id });

describe('readyItems', () => {
  it('pairs each ticket with its project and keeps the order', () => {
    const items = readyItems([web(2), mob(3)], [project, otherProject]);
    expect(items.map((item) => [item.ticket.id, item.project.key])).toEqual([
      ['t-web-2', 'WEB'],
      ['t-3', 'MOB'],
    ]);
  });

  it('drops tickets whose project is gone', () => {
    expect(readyItems([web(2), mob(3)], [project]).map((item) => item.ticket.id)).toEqual(['t-3']);
  });
});

describe('readyCounts', () => {
  it('counts the ready tickets of each project', () => {
    const counts = readyCounts(readyItems([mob(1), web(2), mob(3)], [project, otherProject]));
    expect(counts.get(project.id)).toBe(2);
    expect(counts.get(otherProject.id)).toBe(1);
    expect(counts.get('p-none')).toBeUndefined();
  });
});
