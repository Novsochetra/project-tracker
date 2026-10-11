import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import {
  group,
  readActionSheet,
  seedProject,
  settled,
  settledScreenshot,
  ticketRow,
} from './helpers';

const NO_FILL = 'rgba(0, 0, 0, 0)';

const handle = (page: Page, key: string) =>
  page.getByRole('button', { name: `Move ${key}. Drag, or use the arrow keys.` });

async function showBoard(page: Page): Promise<void> {
  const views = page.getByRole('group', { name: 'Show tickets as' });
  await views.getByRole('button', { name: 'Board' }).click();
  await expect(views.getByRole('button', { name: 'Board' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

const background = (locator: Locator): Promise<string> =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor);

interface HoverParts {
  row: Locator;
  handle: Locator;
  filled: Locator;
}

// The handle sits on its row, so pointing at it still points at the row: the row keeps its hover
// fill and the handle's tile shows on it, not on a white row (PT-149).
async function expectHandleKeepsFill({ row, handle, filled }: HoverParts): Promise<void> {
  await row.hover();
  await settled(filled);
  const hovered = await background(filled);
  expect(hovered).not.toBe(NO_FILL);
  await handle.hover();
  await expect(handle).toHaveCSS('opacity', '1');
  // Read once the row's fill has finished fading: it starts from the hovered colour either way.
  await settled(filled);
  expect(await background(filled)).toBe(hovered);
}

const ticketParts = (page: Page, key: string): HoverParts => ({
  row: ticketRow(page, key),
  handle: handle(page, key),
  filled: ticketRow(page, key),
});

async function openStatuses(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Manage statuses' }).click();
  const sheet = page.getByRole('dialog', { name: 'Statuses' });
  await expect(sheet).toBeVisible();
  return sheet;
}

function statusParts(sheet: Locator, name: string): HoverParts {
  const handle = sheet.getByRole('button', { name: `Reorder ${name}` });
  const filled = handle.locator('xpath=ancestor::li[1]');
  return { row: filled.getByRole('button', { name: new RegExp(`^${name}`) }), handle, filled };
}

test.describe('drag handle hover', () => {
  test.beforeEach(async ({ api, page }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Fix login' }, { title: 'Add search' }]);
    await page.goto('/p/MOB');
    await expect(ticketRow(page, 'MOB-1')).toBeVisible();
  });

  test('a hovered handle keeps its row hovered, in the list and on the board', async ({
    page,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Hover is for a mouse');
    await expectHandleKeepsFill(ticketParts(page, 'MOB-1'));
    await settled(group(page, 'To do'));
    await group(page, 'To do').screenshot({ path: info.outputPath('handle-hover-list.png') });
    await showBoard(page);
    await expectHandleKeepsFill(ticketParts(page, 'MOB-1'));
    await settledScreenshot(page, info.outputPath('handle-hover-board.png'));
  });

  test('a hovered handle keeps its status row hovered', async ({ page }, info) => {
    test.skip(isPhone(info.project.name), 'Hover is for a mouse');
    const sheet = await openStatuses(page);
    await expectHandleKeepsFill(statusParts(sheet, 'Need review'));
    await settledScreenshot(page, info.outputPath('handle-hover-statuses.png'));
  });

  test('phones show every handle on a resting row', async ({ page }, info) => {
    test.skip(!isPhone(info.project.name), 'Phones only');
    await expect(handle(page, 'MOB-1')).toHaveCSS('opacity', '1');
    await expect(handle(page, 'MOB-2')).toHaveCSS('opacity', '1');
    await expect(ticketRow(page, 'MOB-1')).toHaveCSS('background-color', NO_FILL);
    await settled(group(page, 'To do'));
    await group(page, 'To do').screenshot({ path: info.outputPath('handle-list-375.png') });
  });
});
