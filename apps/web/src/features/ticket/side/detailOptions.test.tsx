import { describe, expect, it } from 'vitest';
import { statuses } from '../../../api/test/fixtures';
import { PRIORITY_OPTIONS, statusOptions } from './detailOptions';

describe('status options', () => {
  it('follow the project’s status order and use the status names', () => {
    const reordered = [
      { ...statuses[4]!, position: 0, name: 'Shipped' },
      { ...statuses[0]!, position: 1 },
      { ...statuses[1]!, position: 2 },
    ];
    expect(statusOptions(reordered).map(({ value, label }) => [value, label])).toEqual([
      ['s-done', 'Shipped'],
      ['s-todo', 'To do'],
      ['s-progress', 'In progress'],
    ]);
  });
});

describe('priority options', () => {
  it('run from High to Low', () => {
    expect(PRIORITY_OPTIONS.map(({ label }) => label)).toEqual(['High', 'Medium', 'Low']);
  });
});
