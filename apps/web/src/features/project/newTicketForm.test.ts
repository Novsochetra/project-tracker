import type { Label } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { STATUS, statuses } from '../../api/test/fixtures';
import {
  blankForm,
  chosenStatusId,
  defaultStatusId,
  formFromDraft,
  hasChanges,
  newTicketDraftId,
  toCreateInput,
  withoutGoneStatus,
} from './newTicketForm';
import { withLabels, withoutGoneLabels } from './newTicketLabels';

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
      labelIds: ['bug'],
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

describe('labels on a new ticket', () => {
  const label = (id: string, template: string, position: number): Label => ({
    id,
    projectId: 'p1',
    name: id,
    color: '#B42318',
    template,
    instructions: '',
    position,
    createdAt: 1,
  });
  const labels = [label('bug', '## Steps to reproduce\n', 0), label('ui', '', 1)];

  it('start the description from the template of a label picked while it is empty', () => {
    expect(withLabels(blankForm(), ['bug'], labels)).toEqual({
      labelIds: ['bug'],
      description: '## Steps to reproduce\n',
    });
    const typed = { ...blankForm(), description: 'It crashes.' };
    expect(withLabels(typed, ['bug'], labels)).toEqual({ labelIds: ['bug'] });
    expect(withLabels(blankForm(), ['ui'], labels)).toEqual({ labelIds: ['ui'] });
  });

  it('leave the description alone when a label is taken off or was picked before', () => {
    const picked = { ...blankForm(), labelIds: ['bug'] };
    expect(withLabels(picked, [], labels)).toEqual({ labelIds: [] });
    expect(withLabels(picked, ['bug', 'ui'], labels)).toEqual({ labelIds: ['bug', 'ui'] });
  });

  it('count as a change, are kept with the draft and sent with the ticket', () => {
    const form = { ...blankForm(), labelIds: ['bug'] };
    expect(hasChanges(form, undefined)).toBe(true);
    expect(formFromDraft({ labelIds: ['bug', 7, null] }).labelIds).toEqual(['bug']);
    expect(formFromDraft({ labelIds: 'bug' }).labelIds).toEqual([]);
    expect(toCreateInput({ ...form, title: 'Crash' }, undefined).labelIds).toEqual(['bug']);
    expect(toCreateInput({ ...blankForm(), title: 'Crash' }, undefined)).not.toHaveProperty(
      'labelIds',
    );
  });

  it('drop kept labels deleted since', () => {
    const form = { ...blankForm(), labelIds: ['bug', 'gone'] };
    expect(withoutGoneLabels(form, labels).labelIds).toEqual(['bug']);
    const known = { ...blankForm(), labelIds: ['bug'] };
    expect(withoutGoneLabels(known, labels)).toBe(known);
  });
});
