import { describe, expect, it } from 'vitest';
import type { Status, StatusCategory } from '../../src/domain/status';
import { resolveStatus } from '../../src/logic/statuses';

const status = (id: string, category: StatusCategory, position: number): Status => ({
  id,
  projectId: 'p1',
  name: id,
  category,
  color: '#8E8E99',
  position,
  createdAt: 0,
});

describe('resolveStatus', () => {
  it('never resolves a reviewed step to Done when reviewed and in-review statuses are missing', () => {
    const statuses = [
      status('todo', 'todo', 0),
      status('doing', 'in_progress', 1),
      status('done', 'done', 2),
    ];

    expect(resolveStatus(statuses, 'reviewed').id).toBe('doing');
  });

  it('skips a Done status ordered first when falling back to the first status', () => {
    const statuses = [status('done', 'done', 0), status('todo', 'todo', 1)];

    expect(resolveStatus(statuses, 'in_review').id).toBe('todo');
    expect(resolveStatus(statuses, 'reviewed').id).toBe('todo');
  });
});
