import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// PT-84, from PT-73's review: the phone's files fold opened for files being added by calling
// expand() while rendering, whenever it was folded and an upload ran. So Show less did nothing
// until every upload had finished: each render opened it again. Adding files opens it once.

const PER_ROW = 4;
const ROW = 96;
const THUMB = 72;

// jsdom lays nothing out: the tiles say where they would be, four to a row.
function mockRows() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    if (this.classList.contains('files')) return new DOMRect(0, 0, 343, 24 + ROW + THUMB);
    const grid = this.closest('.grid.removable');
    const tile = [...(grid?.children ?? [])].find((child) => child.contains(this));
    if (!grid || !tile) return new DOMRect(0, 0, 0, 0);
    const row = Math.floor([...grid.children].indexOf(tile) / PER_ROW);
    return new DOMRect(0, 24 + row * ROW, THUMB, THUMB);
  });
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  const rows = mockRows();
  cleanups = [skipAnimations(), () => rows.mockRestore()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

it('folds the files again with Show less while an added file is still uploading', async () => {
  const user = userEvent.setup();
  const files = Array.from({ length: 12 }, (_, index) => attachment(`f${index + 1}`));
  const detail = makeTicketDetail(undefined, { attachments: files });
  const uploadAttachment = vi.fn().mockReturnValue(new Promise(() => undefined));
  cleanups.push(renderTicket({ detail, phone: true, client: { uploadAttachment } }).restorePhone);

  const file = new File(['png'], 'shot.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Add files to ticket'), file);
  const less = await screen.findByRole('button', { name: 'Show less' });
  await waitFor(() => expect(uploadAttachment).toHaveBeenCalled());

  await user.click(less);
  const showAll = screen.getByRole('button', { name: 'Show all 12 files' });
  expect(showAll).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(showAll.getAttribute('aria-controls')!)).toHaveClass('folded');
});

// PT-84's review: after Show less, a second file added while the first was still uploading stayed
// hidden under the fold, because it opened only when the first upload of a run began.
it('opens again for each file added, even while another is still uploading', async () => {
  const user = userEvent.setup();
  const files = Array.from({ length: 12 }, (_, index) => attachment(`f${index + 1}`));
  const detail = makeTicketDetail(undefined, { attachments: files });
  const uploadAttachment = vi.fn().mockReturnValue(new Promise(() => undefined));
  cleanups.push(renderTicket({ detail, phone: true, client: { uploadAttachment } }).restorePhone);
  const input = screen.getByLabelText('Add files to ticket');

  await user.upload(input, new File(['png'], 'first.png', { type: 'image/png' }));
  await user.click(await screen.findByRole('button', { name: 'Show less' }));
  expect(screen.getByRole('button', { name: 'Show all 12 files' })).toBeInTheDocument();

  await user.upload(input, new File(['png'], 'second.png', { type: 'image/png' }));
  await waitFor(() => expect(uploadAttachment).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});
