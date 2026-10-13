import type { Status } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { listItem, otherProject, project, STATUS, statuses } from '../../api/test/fixtures';
import { readyColors, readyCounts, readyItems } from './readyItems';

const webStatuses: Status[] = statuses.map((status, index) => ({
  ...status,
  id: `web-${status.id}`,
  projectId: otherProject.id,
  name: status.category === 'done' ? 'Shipped' : status.name,
  color: status.category === 'reviewed' ? '#12A594' : status.color,
  position: statuses.length - index,
}));

const mob = (num: number) => listItem(num, STATUS.reviewed, 0);
const web = (num: number) =>
  listItem(num, 'web-s-reviewed', 0, { id: `t-web-${num}`, projectId: otherProject.id });

const list = (tickets: ReturnType<typeof listItem>[]) => ({
  tickets,
  statuses: [...statuses, ...webStatuses],
});

describe('readyItems', () => {
  it('pairs each ticket with its project and keeps the order', () => {
    const items = readyItems(list([web(2), mob(3)]), [project, otherProject]);
    expect(items.map((item) => [item.ticket.id, item.project.key])).toEqual([
      ['t-web-2', 'WEB'],
      ['t-3', 'MOB'],
    ]);
  });

  it('gives each ticket its project’s first done status and the color of its status', () => {
    const doneTwice: Status = {
      ...webStatuses[4]!,
      id: 'web-archived',
      name: 'Archived',
      position: 0,
    };
    const items = readyItems(
      { tickets: [web(2), mob(3)], statuses: [...statuses, ...webStatuses, doneTwice] },
      [project, otherProject],
    );
    expect(items.map((item) => [item.doneStatus?.name, item.statusColor])).toEqual([
      ['Archived', '#12A594'],
      ['Done', '#18794E'],
    ]);
  });

  it('has no done status for a project without one', () => {
    const noDone = statuses.filter((status) => status.category !== 'done');
    const [item] = readyItems({ tickets: [mob(3)], statuses: noDone }, [project]);
    expect(item?.doneStatus).toBeNull();
    expect(item?.statusColor).toBe('#18794E');
  });

  it('drops tickets whose project is gone', () => {
    const items = readyItems(list([web(2), mob(3)]), [project]);
    expect(items.map((item) => item.ticket.id)).toEqual(['t-3']);
  });

  it('passes over tickets and statuses it cannot read', () => {
    const items = readyItems(
      {
        tickets: [null, mob(3), 'text'],
        statuses: [null, ...statuses],
      } as unknown as Parameters<typeof readyItems>[0],
      [project],
    );
    expect(items.map((item) => [item.ticket.id, item.doneStatus?.name])).toEqual([['t-3', 'Done']]);
  });

  it('is empty until the ready list loads', () => {
    expect(readyItems(undefined, [project])).toEqual([]);
  });
});

describe('readyColors', () => {
  it('takes each project’s Reviewed color from its newest ready ticket', () => {
    const colors = readyColors(readyItems(list([web(2), mob(1)]), [project, otherProject]));
    expect(colors.get(otherProject.id)).toBe('#12A594');
    expect(colors.get(project.id)).toBe(statuses.find((s) => s.category === 'reviewed')?.color);
    expect(colors.get('p-none')).toBeUndefined();
  });
});

describe('readyCounts', () => {
  it('counts the ready tickets of each project', () => {
    const counts = readyCounts(readyItems(list([mob(1), web(2), mob(3)]), [project, otherProject]));
    expect(counts.get(project.id)).toBe(2);
    expect(counts.get(otherProject.id)).toBe(1);
    expect(counts.get('p-none')).toBeUndefined();
  });
});
