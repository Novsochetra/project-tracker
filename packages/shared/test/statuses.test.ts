import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATUSES,
  STATUS_CATEGORIES,
  type Status,
  type StatusCategory,
} from '../src/domain/status';
import {
  findStatusByCategory,
  findStatusByName,
  resolveStatus,
  sortStatuses,
} from '../src/logic/statuses';

const status = (
  name: string,
  category: StatusCategory,
  position: number,
  createdAt = 0,
): Status => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  projectId: 'p1',
  name,
  category,
  color: '#8E8E99',
  position,
  createdAt,
});

const defaults = DEFAULT_STATUSES.map((template, position) =>
  status(template.name, template.category, position),
);

const without = (...categories: StatusCategory[]) =>
  defaults.filter((s) => !categories.includes(s.category));

describe('sortStatuses', () => {
  it('orders statuses by position', () => {
    const shuffled = [status('C', 'done', 2), status('A', 'todo', 0), status('B', 'todo', 1)];

    expect(sortStatuses(shuffled).map((s) => s.name)).toEqual(['A', 'B', 'C']);
  });

  it('breaks position ties by creation time', () => {
    const tied = [status('Later', 'todo', 0, 20), status('Earlier', 'todo', 0, 10)];

    expect(sortStatuses(tied).map((s) => s.name)).toEqual(['Earlier', 'Later']);
  });

  it('leaves the input array unchanged', () => {
    const input = [status('B', 'todo', 1), status('A', 'todo', 0)];

    sortStatuses(input);

    expect(input.map((s) => s.name)).toEqual(['B', 'A']);
  });
});

describe('findStatusByCategory', () => {
  it('finds the status with the category', () => {
    expect(findStatusByCategory(defaults, 'in_review')?.name).toBe('Need review');
  });

  it('returns the first match in position order', () => {
    const statuses = [status('Backlog', 'todo', 3), status('To do', 'todo', 0)];

    expect(findStatusByCategory(statuses, 'todo')?.name).toBe('To do');
  });

  it('returns undefined when no status has the category', () => {
    expect(findStatusByCategory(without('reviewed'), 'reviewed')).toBeUndefined();
  });
});

describe('resolveStatus', () => {
  it.each(STATUS_CATEGORIES.map((category) => [category]))(
    'returns the %s status when the project has one',
    (category) => {
      expect(resolveStatus(defaults, category).category).toBe(category);
    },
  );

  it('returns the first status of the category in position order', () => {
    const statuses = [...defaults, status('Up next', 'todo', -1)];

    expect(resolveStatus(statuses, 'todo').name).toBe('Up next');
  });

  it.each<[StatusCategory, string]>([
    ['todo', 'To do'],
    ['in_progress', 'To do'],
    ['in_review', 'To do'],
    ['reviewed', 'To do'],
    ['done', 'Done'],
  ])('in a project with only To do and Done, resolves %s to %s', (category, expected) => {
    const statuses = without('in_progress', 'in_review', 'reviewed');

    expect(resolveStatus(statuses, category).name).toBe(expected);
  });

  it.each<[StatusCategory, string]>([
    ['in_progress', 'In progress'],
    ['in_review', 'In progress'],
    ['reviewed', 'In progress'],
  ])('without review statuses, resolves %s to %s', (category, expected) => {
    const statuses = without('in_review', 'reviewed');

    expect(resolveStatus(statuses, category).name).toBe(expected);
  });

  it('falls back from in_review to reviewed', () => {
    expect(resolveStatus(without('in_review'), 'in_review').name).toBe('Reviewed');
  });

  it('falls back from reviewed to in_review', () => {
    expect(resolveStatus(without('reviewed'), 'reviewed').name).toBe('Need review');
  });

  it('falls back from in_progress to todo', () => {
    expect(resolveStatus(without('in_progress'), 'in_progress').name).toBe('To do');
  });

  it('falls back from todo to the first status that is not done', () => {
    expect(resolveStatus(without('todo'), 'todo').name).toBe('In progress');
  });

  it('falls back from done to the first status', () => {
    expect(resolveStatus(without('done'), 'done').name).toBe('To do');
  });

  it('never resolves a step other than done to a done status while another status exists', () => {
    const statuses = [status('Shipped', 'done', 0), status('Inbox', 'todo', 1)];

    for (const category of STATUS_CATEGORIES.filter((c) => c !== 'done')) {
      expect(resolveStatus(statuses, category).name).toBe('Inbox');
    }
  });

  it('uses the only status a project has', () => {
    const only = [status('Done', 'done', 0)];

    expect(resolveStatus(only, 'todo').name).toBe('Done');
  });

  it('throws for a project without statuses', () => {
    expect(() => resolveStatus([], 'todo')).toThrow('A project always has at least one status.');
  });
});

describe('findStatusByName', () => {
  it('matches names case-insensitively', () => {
    expect(findStatusByName(defaults, 'in PROGRESS')?.category).toBe('in_progress');
    expect(findStatusByName(defaults, 'need review')?.category).toBe('in_review');
  });

  it('ignores spaces around the wanted name', () => {
    expect(findStatusByName(defaults, '  Done ')?.category).toBe('done');
  });

  it('returns undefined for an unknown name', () => {
    expect(findStatusByName(defaults, 'Blocked')).toBeUndefined();
    expect(findStatusByName(defaults, '')).toBeUndefined();
  });

  it('matches the whole name, not a part of it', () => {
    expect(findStatusByName(defaults, 'review')).toBeUndefined();
  });
});
