import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { activity, group, seedProject, ticketRow, toast } from './helpers';

const showBoard = async (page: Page): Promise<void> => {
  await page
    .getByRole('group', { name: 'Show tickets as' })
    .getByRole('button', { name: 'Board' })
    .click();
  await expect(group(page, 'Need review')).toBeVisible();
};

const board = (page: Page) => page.locator('[data-board]');
const pager = (page: Page) => page.locator('[data-board-pager]');

/** How far the column at `index` starts from the board's left edge. */
const columnOffset = (page: Page, index: number) =>
  board(page).evaluate((element, at) => {
    const column = element.querySelectorAll('[data-drop-group]')[at];
    if (!column) return null;
    return Math.round(column.getBoundingClientRect().left - element.getBoundingClientRect().left);
  }, index);

async function pressAndLift(page: Page, card: Locator): Promise<void> {
  const from = await card.boundingBox();
  if (!from) throw new Error('Missing card box');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + from.height / 2 + 8, { steps: 3 });
}

async function dropOn(page: Page, column: Locator): Promise<void> {
  const to = await column.boundingBox();
  if (!to) throw new Error('Missing column box');
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 12 });
  await page.mouse.up();
}

test.describe('board', () => {
  test('dragging a card to another column changes its status', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Mouse drag is desktop only');
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Ready to review' },
      { title: 'Being built', status: 'In progress' },
    ]);
    await page.goto('/p/MOB');
    await showBoard(page);
    await expect(group(page, 'Reviewed')).toContainText('No tickets');

    await pressAndLift(page, ticketRow(page, 'MOB-1'));
    await dropOn(page, group(page, 'Need review'));
    await expect(group(page, 'Need review')).toContainText('Ready to review');
    await expect(toast(page, 'MOB-1 moved to Need review')).toBeVisible();

    await page.reload();
    await expect(group(page, 'Need review')).toContainText('Ready to review');
    await ticketRow(page, 'MOB-1').click();
    await expect(activity(page)).toContainText('You changed status to Need review');
  });

  test('a card dragged to the right edge scrolls the board to far columns', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Mouse drag is desktop only');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ship it' }]);
    await page.goto('/p/MOB');
    await showBoard(page);
    const box = await board(page).boundingBox();
    if (!box) throw new Error('Missing board box');

    await pressAndLift(page, ticketRow(page, 'MOB-1'));
    await page.mouse.move(box.x + box.width - 8, box.y + 200, { steps: 10 });
    await expect
      .poll(() =>
        board(page).evaluate(
          (element) => element.scrollWidth - element.clientWidth - element.scrollLeft,
        ),
      )
      .toBeLessThan(1);
    await dropOn(page, group(page, 'Done'));
    await expect(group(page, 'Done')).toContainText('Ship it');
    await expect(toast(page, 'MOB-1 moved to Done')).toBeVisible();
  });

  test('columns page with snapping and the indicator follows', async ({ page, api }, info) => {
    test.skip(!isPhone(info.project.name), 'Paging is the phone layout');
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'First thing' },
      { title: 'Being built', status: 'In progress' },
    ]);
    await page.goto('/p/MOB');
    await showBoard(page);
    await expect(pager(page)).toHaveText(/To do\s*1 \/ 5/);

    // Part of a swipe: the board settles on the nearer column, aligned with the padding.
    await board(page).evaluate((element) => element.scrollTo({ left: 200 }));
    await expect.poll(() => columnOffset(page, 1)).toBe(16);
    await expect(pager(page)).toHaveText(/In progress\s*2 \/ 5/);

    await board(page).evaluate((element) => element.scrollTo({ left: 100_000 }));
    await expect(pager(page)).toHaveText(/Done\s*5 \/ 5/);

    await board(page).evaluate((element) => element.scrollTo({ left: 0 }));
    await expect(pager(page)).toHaveText(/To do\s*1 \/ 5/);
    await ticketRow(page, 'MOB-1').tap();
    await expect(page).toHaveURL(/\/p\/MOB\/1$/);
  });

  test('the board is remembered for the project', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Alpha' }]);
    await seedProject(api, 'Website', 'WEB', [{ title: 'Beta' }]);
    await page.goto('/p/MOB');
    await showBoard(page);
    await page.reload();
    await expect(group(page, 'Need review')).toBeVisible();
    await page.goto('/p/WEB');
    await expect(group(page, 'To do')).toBeVisible();
    await expect(group(page, 'Need review')).toBeHidden();
  });
});
