import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attachment, TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../src/api/queryKeys';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 65 (PT-93): a ticket file the tracker sent without an id got a tile with no key of its
// own, so React logged its key warning, and its Remove sent DELETE /api/attachments/undefined,
// which answered "Attachment was not found."

const NO_ID = { ...attachment('x'), id: undefined } as unknown as Attachment;
const NULL_ID = { ...attachment('y'), id: null } as unknown as Attachment;
const A1 = attachment('a1');
const A2 = attachment('a2');

let cleanups: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  consoleError.mockRestore();
});

const keyWarnings = () =>
  consoleError.mock.calls
    .map((call) => call.map(String).join(' '))
    .filter((line) => /same key|unique "key"/.test(line));

it('leaves out a ticket file without an id and never removes one by an undefined id', async () => {
  const user = userEvent.setup();
  const deleteAttachment = vi.fn().mockResolvedValue(undefined);
  const detail = makeTicketDetail(undefined, { attachments: [A1, NO_ID, NULL_ID, A2] });
  const rendered = renderTicket({ detail, client: { deleteAttachment } });
  cleanups.push(rendered.restorePhone);
  const cached = () =>
    rendered.queryClient.getQueryData<TicketDetail>(queryKeys.ticket('MOB-1'))?.attachments;

  expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Open image 3' })).toBeNull();
  expect(keyWarnings()).toEqual([]);

  await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
  await new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));
  await user.click(screen.getByRole('button', { name: 'Remove' }));

  expect(deleteAttachment).toHaveBeenCalledTimes(1);
  expect(deleteAttachment).toHaveBeenCalledWith('a2');
  await waitFor(() => expect(cached()).toEqual([A1, NO_ID, NULL_ID]));
  expect(keyWarnings()).toEqual([]);
});
