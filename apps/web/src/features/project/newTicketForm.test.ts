import { describe, expect, it } from 'vitest';
import { STATUS, statuses } from '../../api/test/fixtures';
import { blankForm, chosenStatusId, defaultStatusId, toCreateInput } from './newTicketForm';

describe('defaultStatusId', () => {
  it('uses the status of the group the sheet was opened from', () => {
    expect(defaultStatusId(statuses, STATUS.review)).toBe(STATUS.review);
  });

  it('falls back to the first status in order', () => {
    expect(defaultStatusId(statuses, undefined)).toBe(STATUS.todo);
    expect(defaultStatusId(statuses, 'deleted-status')).toBe(STATUS.todo);
    const reordered = statuses.map((status) =>
      status.id === STATUS.progress ? { ...status, position: -1 } : status,
    );
    expect(defaultStatusId(reordered, undefined)).toBe(STATUS.progress);
  });

  it('has none before the statuses load', () => {
    expect(defaultStatusId([], STATUS.todo)).toBeUndefined();
  });
});

describe('chosenStatusId', () => {
  it('prefers the status the person picked', () => {
    const form = { ...blankForm(), statusId: STATUS.done };
    expect(chosenStatusId(form, statuses, STATUS.review)).toBe(STATUS.done);
    expect(chosenStatusId(blankForm(), statuses, STATUS.review)).toBe(STATUS.review);
  });
});

describe('toCreateInput', () => {
  it('trims the text fields and keeps the rest', () => {
    const form = {
      ...blankForm(),
      title: '  Crash on rotate ',
      description: ' Steps \n',
      assignee: ' Dara ',
      priority: 'high' as const,
      due: '2026-10-09',
    };
    expect(toCreateInput(form, STATUS.todo)).toEqual({
      title: 'Crash on rotate',
      description: 'Steps',
      assignee: 'Dara',
      priority: 'high',
      due: '2026-10-09',
      statusId: STATUS.todo,
    });
  });

  it('leaves the status to the server when there is none yet', () => {
    expect(toCreateInput(blankForm(), undefined)).not.toHaveProperty('statusId');
  });
});
