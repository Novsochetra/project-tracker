import { describe, expect, it } from 'vitest';
import { givenTo } from '../../src/dataMove/owner';
import type { TableRows } from '../../src/dataMove/rows';

const ROWS = {
  projects: [{ id: 'p1', ownerId: 'local-owner' }],
  statuses: [],
  tickets: [],
  activities: [],
  attachments: [{ id: 'f1', userId: 'local-owner' }],
} as unknown as TableRows;

describe('givenTo', () => {
  it("gives every moved project and file to the target's owner", () => {
    const moved = givenTo(ROWS, 'online-owner');
    expect(moved.projects).toMatchObject([{ id: 'p1', ownerId: 'online-owner' }]);
    expect(moved.attachments).toMatchObject([{ id: 'f1', userId: 'online-owner' }]);
  });

  it('leaves them to nobody on a target without an owner, for owner-set to give out', () => {
    const moved = givenTo(ROWS, null);
    expect(moved.projects[0]?.ownerId).toBeNull();
    expect(moved.attachments[0]?.userId).toBeNull();
  });
});
