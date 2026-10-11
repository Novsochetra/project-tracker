import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { group, seedProject, settled, settledScreenshot, ticketRow } from './helpers';

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

// The handle sits on its row, so pointing at it still points at the row: the row keeps its hover
// fill and the handle's tile shows on it, not on a white row (PT-149).
async function expectRowKeepsHover(page: Page, key: string): Promise<void> {
  const row = ticketRow(page, key);
  await row.hover({ position: { x: 200, y: 10 } });
  await settled(row);
  const hovered = await background(row);
  expect(hovered).not.toBe(NO_FILL);
  await handle(page, key).hover();
  await expect(handle(page, key)).toHaveCSS('opacity', '1');
  // Read once the row's fill has finished fading: it starts from the hovered colour either way.
  await settled(row);
  expect(await background(row)).toBe(hovered);
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
    await expectRowKeepsHover(page, 'MOB-1');
    await settled(group(page, 'To do'));
    await group(page, 'To do').screenshot({ path: info.outputPath('handle-hover-list.png') });
    await showBoard(page);
    await expectRowKeepsHover(page, 'MOB-1');
    await settledScreenshot(page, info.outputPath('handle-hover-board.png'));
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
