import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CreateStatusInput, Status } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBoard, statuses } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { StatusManagerSheet } from '../../src/features/statuses/StatusManagerSheet';
import { mockPhone } from '../../src/overlays/testing';

// The phone sheet sits on the bottom edge and grows upward with its content, up to 32px from
// the top. Measured in WebKit at 375×812 with five statuses: the sheet's top is at 334, the list
// starts 137px into it, rows are 53px, an open editor 367px, and 76px follow the list.
const PHONE = { height: 812, minTop: 32, aboveList: 137, belowList: 76, row: 53, editor: 367 };

const heightOf = (item: Element) => (item.querySelector('form') ? PHONE.editor : PHONE.row);
const listHeight = (list: Element) =>
  [...list.children].reduce((sum, item) => sum + heightOf(item), 0);

function listTop(list: Element): number {
  const newEditor = document.querySelector('form[aria-label="New status"]') ? PHONE.editor : 0;
  const content = PHONE.aboveList + listHeight(list) + newEditor + PHONE.belowList;
  return Math.max(PHONE.minTop, PHONE.height - content) + PHONE.aboveList;
}

// jsdom has no layout, so the list and its rows get the boxes they have in that sheet.
function boxOf(element: Element): DOMRect {
  const list = element.tagName === 'LI' ? element.parentElement : element;
  if (!list || list.tagName !== 'UL') return new DOMRect();
  if (element === list) return new DOMRect(16, listTop(list), 343, listHeight(list));
  const before = [...list.children].slice(0, [...list.children].indexOf(element));
  const offset = before.reduce((sum, item) => sum + heightOf(item), 0);
  return new DOMRect(16, listTop(list) + offset, 343, heightOf(element));
}

function statusServer() {
  let board = makeBoard();
  const create = (input: CreateStatusInput): Status => ({
    ...statuses[0]!,
    ...input,
    id: 's-new',
    position: board.statuses.length,
  });
  const byId = (id: string) => board.statuses.find((status) => status.id === id)!;
  return {
    getBoard: vi.fn(() => Promise.resolve(board)),
    createStatus: vi.fn((_key: string, input: CreateStatusInput) => {
      const status = create(input);
      board = { ...board, statuses: [...board.statuses, status] };
      return Promise.resolve(status);
    }),
    reorderStatuses: vi.fn((_key: string, ids: string[]) => {
      board = { ...board, statuses: ids.map((id, position) => ({ ...byId(id), position })) };
      return Promise.resolve(board.statuses);
    }),
  };
}

const sheet = () => screen.getByRole('dialog', { name: 'Statuses' });
const items = () => within(sheet()).getAllByRole('listitem');
const button = (name: string | RegExp) => within(sheet()).getByRole('button', { name });
const frames = () => new Promise((resolve) => setTimeout(resolve, 80));

// A layout animation starts the row a whole move away, as a translate, and slides it back.
const shiftOf = (element: HTMLElement): number => {
  const match = /translate3d\([^,]+,\s*([-\d.]+)px/.exec(element.style.transform);
  return match ? Math.abs(Number(match[1])) : 0;
};

async function openSheet() {
  const api = setupApi(statusServer());
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <StatusManagerSheet open onClose={() => undefined} projectKey="MOB" />
      </ToastProvider>
    </Wrapper>,
  );
  await within(sheet()).findByText('To do', { exact: true });
  await frames();
  return userEvent.setup();
}

let restore: Array<() => void> = [];

beforeEach(() => {
  const geometry = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      return boxOf(this);
    });
  restore = [mockPhone(true), () => geometry.mockRestore()];
});

afterEach(() => restore.forEach((undo) => undo()));

// Rows animate their layout so a reorder slides. Opening an editor grew the sheet upward by
// 302px, so the rows above it read as moved and jumped 302px down, sliding back over 0.5s.
describe('regression: status editors open and close in place on phones', () => {
  it('moves no row as an editor opens', async () => {
    const user = await openSheet();
    const rows = items();
    await user.click(button(/^In progress/));
    await within(sheet()).findByRole('form', { name: 'Edit In progress' });
    await frames();
    expect(rows.map(shiftOf)).toEqual([0, 0, 0, 0, 0]);
  });

  it('moves no row as it closes', async () => {
    const user = await openSheet();
    await user.click(button(/^Need review/));
    await within(sheet()).findByRole('form', { name: 'Edit Need review' });
    await frames();
    await user.click(button('Cancel'));
    await frames();
    expect(items().map(shiftOf)).toEqual([0, 0, 0, 0, 0]);
  });

  it('moves no row as a new status editor opens below them', async () => {
    const user = await openSheet();
    const rows = items();
    await user.click(button('Add status'));
    await within(sheet()).findByRole('form', { name: 'New status' });
    await frames();
    expect(rows.map(shiftOf)).toEqual([0, 0, 0, 0, 0]);
  });

  it('keeps the rows above still when the saved status joins the list', async () => {
    const user = await openSheet();
    const rows = items();
    await user.click(button('Add status'));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Status name' }), 'QA');
    await user.click(button('Save status'));
    await within(sheet()).findByText('QA', { exact: true });
    await frames();
    expect(rows.map(shiftOf)).toEqual([0, 0, 0, 0, 0]);
  });

  it('still slides rows into place when the order changes', async () => {
    const user = await openSheet();
    button('Reorder Reviewed').focus();
    await user.keyboard('{ArrowUp}');
    const [, , reviewed, needReview] = items();
    expect(reviewed).toHaveTextContent('Reviewed');
    await waitFor(() =>
      expect(Math.min(shiftOf(reviewed!), shiftOf(needReview!))).toBeGreaterThan(0),
    );
  });
});
