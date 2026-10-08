import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment, makeTicketDetail } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket } from '../test/renderTicket';

const PER_ROW = 4;
const ROW = 96;
const THUMB = 72;

// jsdom lays nothing out: the grid's tiles say where they would be, four to a row, 72px tall in
// rows 96px apart, and the box around them is two rows tall.
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

function setup(count: number, phone = true, client = {}) {
  const files = Array.from({ length: count }, (_, index) => attachment(`f${index + 1}`));
  const detail = makeTicketDetail(undefined, { attachments: files });
  const rendered = renderTicket({ detail, phone, client });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const showAll = () => screen.getByRole('button', { name: /^Show all \d+ files$/ });
const filesBox = () => document.getElementById(showAll().getAttribute('aria-controls')!)!;

describe('many files on the phone’s ticket screen', () => {
  it('fold after two rows, with Show all and an Add files button', () => {
    setup(12);
    expect(showAll()).toHaveAccessibleName('Show all 12 files');
    expect(showAll()).toHaveAttribute('aria-expanded', 'false');
    expect(filesBox()).toHaveClass('folded');
    expect(filesBox()).toHaveStyle({ maxHeight: `${24 + ROW + THUMB}px` });
    const add = screen.getAllByRole('button', { name: 'Add files' });
    expect(add).toHaveLength(1);
    expect(add[0]).toHaveTextContent('Add files');
  });

  it('show them all with the Add tile at the end, and fold again with Show less', async () => {
    const user = userEvent.setup();
    setup(12);
    await user.click(showAll());
    const less = screen.getByRole('button', { name: 'Show less' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(less.getAttribute('aria-controls')!)).not.toHaveClass('folded');
    expect(screen.getByRole('button', { name: 'Add files' })).toHaveTextContent('');
    await user.click(less);
    expect(showAll()).toHaveAttribute('aria-expanded', 'false');
  });

  it('open for good when files are added, so the new ones show', async () => {
    const user = userEvent.setup();
    setup(12, true, { uploadAttachment: vi.fn().mockReturnValue(new Promise(() => undefined)) });
    const file = new File(['png'], 'shot.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Add files to ticket'), file);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument(),
    );
  });

  it('open when Tab reaches a file below the fold', () => {
    setup(12);
    const last = screen.getByRole('button', { name: 'Open image 12' });
    act(() => last.focus());
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('stay whole in two rows', () => {
    setup(8);
    expect(screen.queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add files' })).toHaveTextContent('');
  });
});

it('shows every file on desktop', () => {
  setup(12, false);
  expect(screen.queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();
});
