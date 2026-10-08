import { describe, expect, it } from 'vitest';
import { STATUS, statuses } from '../../api/test/fixtures';
import {
  blankForm,
  chosenStatusId,
  defaultStatusId,
  formFromDraft,
  newTicketDraftId,
  toCreateInput,
  withoutGoneStatus,
} from './newTicketForm';

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

  it('falls back to the default when the picked status is gone, as in an old draft', () => {
    const form = { ...blankForm(), statusId: 'deleted-status' };
    expect(chosenStatusId(form, statuses, STATUS.review)).toBe(STATUS.review);
  });
});

describe('withoutGoneStatus', () => {
  it('drops a picked status that no longer exists, and keeps the form otherwise', () => {
    const gone = { ...blankForm(), title: 'Idea', statusId: 'deleted-status' };
    expect(withoutGoneStatus(gone, statuses)).toEqual({ ...gone, statusId: null });
    const picked = { ...blankForm(), statusId: STATUS.done };
    expect(withoutGoneStatus(picked, statuses)).toBe(picked);
    const unpicked = blankForm();
    expect(withoutGoneStatus(unpicked, statuses)).toBe(unpicked);
  });
});

describe('new ticket drafts', () => {
  it('are kept per project', () => {
    expect(newTicketDraftId('MOB')).toBe('new-ticket:MOB');
    expect(newTicketDraftId('WEB')).not.toBe(newTicketDraftId('MOB'));
  });

  it('read back into the form they were kept from', () => {
    const form = {
      title: 'Crash on rotate',
      description: 'Steps',
      statusId: STATUS.done,
      priority: 'high' as const,
      assignee: 'Dara',
      due: '2026-10-09',
      attachments: [],
    };
    expect(formFromDraft({ ...form })).toEqual(form);
  });

  it('fill what they lack or cannot read from a blank form', () => {
    expect(formFromDraft(undefined)).toEqual(blankForm());
    expect(formFromDraft({ title: 'Typed', statusId: 7, priority: 'urgent', due: null })).toEqual({
      ...blankForm(),
      title: 'Typed',
    });
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
