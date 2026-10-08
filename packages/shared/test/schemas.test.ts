import { describe, expect, it } from 'vitest';
import {
  createCommentInput,
  createStatusInput,
  createTicketInput,
  reviewInput,
} from '../src/api/schemas';

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('createTicketInput', () => {
  it('fills in defaults for everything but the title', () => {
    expect(createTicketInput.parse({ title: 'Fix login' })).toEqual({
      title: 'Fix login',
      description: '',
      priority: 'medium',
      assignee: '',
      due: '',
      attachmentIds: [],
    });
  });

  it('trims the title and assignee', () => {
    const parsed = createTicketInput.parse({ title: '  Fix login  ', assignee: '  Dara ' });

    expect(parsed.title).toBe('Fix login');
    expect(parsed.assignee).toBe('Dara');
  });

  it('keeps the description as typed', () => {
    expect(createTicketInput.parse({ title: 'T', description: '  Steps\n' }).description).toBe(
      '  Steps\n',
    );
  });

  it('rejects a missing or blank title with the form message', () => {
    expect(createTicketInput.safeParse({}).success).toBe(false);
    expect(messages(createTicketInput.safeParse({ title: '   ' }))).toEqual([
      'Add a title to create the ticket.',
    ]);
  });

  it('accepts a due date as YYYY-MM-DD or empty', () => {
    expect(createTicketInput.parse({ title: 'T', due: '2026-10-09' }).due).toBe('2026-10-09');
    expect(createTicketInput.parse({ title: 'T', due: '' }).due).toBe('');
  });

  it.each(['2026-1-9', '10/09/2026', '2026-10-09T00:00:00', 'tomorrow', ' 2026-10-09'])(
    'rejects the due date %j',
    (due) => {
      expect(createTicketInput.safeParse({ title: 'T', due }).success).toBe(false);
    },
  );

  it('rejects an unknown priority', () => {
    expect(createTicketInput.safeParse({ title: 'T', priority: 'urgent' }).success).toBe(false);
  });

  it('accepts up to 20 attachment ids', () => {
    const ids = (count: number) => Array.from({ length: count }, (_, index) => `a${index}`);

    expect(createTicketInput.safeParse({ title: 'T', attachmentIds: ids(20) }).success).toBe(true);
    expect(createTicketInput.safeParse({ title: 'T', attachmentIds: ids(21) }).success).toBe(false);
  });

  it('takes an optional client id of up to 64 characters', () => {
    const uuid = '0c6f1d2e-5b7a-4e3c-9d18-7a2b4c6e8f10';

    expect(createTicketInput.parse({ title: 'T', clientId: uuid }).clientId).toBe(uuid);
    expect(createTicketInput.parse({ title: 'T' })).not.toHaveProperty('clientId');
    expect(createTicketInput.safeParse({ title: 'T', clientId: '' }).success).toBe(false);
    expect(createTicketInput.safeParse({ title: 'T', clientId: 'x'.repeat(65) }).success).toBe(
      false,
    );
  });
});

describe('createCommentInput', () => {
  it('accepts text without attachments', () => {
    expect(createCommentInput.parse({ text: 'Looks good' })).toEqual({
      text: 'Looks good',
      attachmentIds: [],
    });
  });

  it('accepts attachments without text', () => {
    expect(createCommentInput.parse({ attachmentIds: ['a1'] })).toEqual({
      text: '',
      attachmentIds: ['a1'],
    });
  });

  it('rejects a comment with neither text nor attachments', () => {
    expect(messages(createCommentInput.safeParse({}))).toEqual(['Write a comment or add a file.']);
    expect(messages(createCommentInput.safeParse({ text: '  \n ', attachmentIds: [] }))).toEqual([
      'Write a comment or add a file.',
    ]);
  });
});

describe('reviewInput', () => {
  const review = { verdict: 'approved', rating: 4, summary: 'Works as described.' };

  it.each([1, 2, 3, 4, 5])('accepts rating %i', (rating) => {
    expect(reviewInput.safeParse({ ...review, rating }).success).toBe(true);
  });

  it.each([0, 6, -1, 2.5, Number.NaN])('rejects rating %d', (rating) => {
    expect(reviewInput.safeParse({ ...review, rating }).success).toBe(false);
  });

  it('rejects a rating sent as a string', () => {
    expect(reviewInput.safeParse({ ...review, rating: '4' }).success).toBe(false);
  });

  it('accepts only the approved and changes_requested verdicts', () => {
    expect(reviewInput.safeParse({ ...review, verdict: 'changes_requested' }).success).toBe(true);
    expect(reviewInput.safeParse({ ...review, verdict: 'rejected' }).success).toBe(false);
  });

  it('trims the summary and requires one', () => {
    expect(reviewInput.parse({ ...review, summary: '  Fine.  ' }).summary).toBe('Fine.');
    expect(reviewInput.safeParse({ ...review, summary: '   ' }).success).toBe(false);
  });
});

describe('createStatusInput', () => {
  it.each(['#5B5BD6', '#5b5bd6', '#000000', '#FFFFFF'])('accepts the color %s', (color) => {
    expect(createStatusInput.safeParse({ name: 'Blocked', category: 'todo', color }).success).toBe(
      true,
    );
  });

  it.each(['5B5BD6', '#FFF', '#5B5BD6FF', 'red', '#GGGGGG', ' #5B5BD6', ''])(
    'rejects the color %j with the hex color message',
    (color) => {
      const result = createStatusInput.safeParse({ name: 'Blocked', category: 'todo', color });

      expect(messages(result)).toEqual(['Use a hex color like #5B5BD6']);
    },
  );

  it('makes the color optional', () => {
    expect(createStatusInput.parse({ name: 'Blocked', category: 'in_progress' })).toEqual({
      name: 'Blocked',
      category: 'in_progress',
    });
  });

  it('trims the name and rejects a blank one', () => {
    expect(createStatusInput.parse({ name: '  QA  ', category: 'in_review' }).name).toBe('QA');
    expect(createStatusInput.safeParse({ name: '  ', category: 'in_review' }).success).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(createStatusInput.safeParse({ name: 'Blocked', category: 'blocked' }).success).toBe(
      false,
    );
  });
});
