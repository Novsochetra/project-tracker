import { screen } from '@testing-library/react';
import type { Attachment } from '@tracker/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 65 (PT-93): a file the tracker sent without an activityId was neither the ticket's (that
// list took only null) nor any comment's, so it showed nowhere and couldn't be removed.

const { activityId: _activityId, ...withoutActivity } = attachment('a2');

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

it('shows a file without an activityId among the ticket’s own files', () => {
  const detail = makeTicketDetail(undefined, {
    attachments: [
      attachment('a1'),
      withoutActivity as Attachment,
      attachment('c1-file', { activityId: 'c1' }),
    ],
  });
  const rendered = renderTicket({ detail });
  cleanups.push(rendered.restorePhone);

  expect(screen.getByRole('button', { name: 'Remove image 1' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove image 2' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2);
});
