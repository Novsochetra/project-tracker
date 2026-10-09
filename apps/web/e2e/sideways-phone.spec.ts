import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { group, seedProject, ticketRow } from './helpers';

// PT-84's review: an iPhone held sideways in Safari leaves about 300px of height for the page
// (874×296 on an iPhone 17 Pro, under Safari's address and tab bars). The project screen's two
// filter rows took it all, so no ticket showed without scrolling, and on the board the cards began
// under the bottom bar. Sideways, the bars are only as tall as their buttons, the status tabs share
// a row with the search, and the board drops its pager row.

test.use({
  viewport: { width: 874, height: 296 },
  contextOptions: { screen: { width: 402, height: 874 } },
});

const bottomBar = (page: Page) => page.locator('[data-stack-path="/p/MOB"] [data-bottom-bar]');

async function aboveTheBar(page: Page, target: Locator): Promise<number> {
  const barTop = (await bottomBar(page).boundingBox())!.y;
  const box = (await target.boundingBox())!;
  return barTop - box.y;
}

test.describe('a phone held sideways in Safari', () => {
  test('shows tickets on the project screen and cards on the board without scrolling', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'A phone');
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Crash when rotating the profile screen' },
      { title: 'Dark mode colors for Settings' },
    ]);
    await page.goto('/p/MOB');
    const row = ticketRow(page, 'MOB-\\d+');
    await expect(row).toBeVisible();
    const rowHeight = (await row.boundingBox())!.height;
    expect(await aboveTheBar(page, row)).toBeGreaterThanOrEqual(rowHeight);

    await page
      .getByRole('group', { name: 'Show tickets as' })
      .getByRole('button', { name: 'Board' })
      .click();
    const card = page
      .locator('[data-board] [data-drop-group]')
      .first()
      .getByRole('button', { name: /^MOB-\d+\b/ })
      .first();
    await expect(card).toBeVisible();
    // The card's key and title show above the bar.
    expect(await aboveTheBar(page, card)).toBeGreaterThanOrEqual(48);
  });
});

// PT-84's second review: on one row, the search and the List/Board switch shrank with the tabs'
// track below their own width, and the switch ran off the right edge on smaller phones held
// sideways: 3px of Board showed on an iPhone SE (667×375), none on a Galaxy S9+ (658×320), and on
// notched iPhones the camera's safe-area padding pushed it further. The tabs scroll instead.
async function switchFits(page: Page): Promise<void> {
  await page.goto('/p/MOB');
  const board = page
    .getByRole('group', { name: 'Show tickets as' })
    .getByRole('button', { name: 'Board' });
  await expect(board).toBeVisible();
  const listRight = await group(page, 'To do').evaluate(
    (element) => element.getBoundingClientRect().right,
  );
  const boardRight = (await board.boundingBox())!;
  expect(boardRight.x + boardRight.width).toBeLessThanOrEqual(listRight + 0.5);
  await board.tap();
  await expect(page.locator('[data-board]')).toBeVisible();
}

test.describe('a small phone held sideways', () => {
  test.use({
    viewport: { width: 667, height: 375 },
    contextOptions: { screen: { width: 375, height: 667 } },
  });

  test('keeps the List/Board switch on screen', async ({ page, api }, info) => {
    test.skip(!isPhone(info.project.name), 'A phone');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await switchFits(page);
  });
});

test.describe('a notched phone held sideways', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    contextOptions: { screen: { width: 390, height: 844 } },
    isMobile: true,
    hasTouch: true,
  });

  test('keeps the List/Board switch clear of the camera', async ({ page, api }, info) => {
    test.skip(
      info.project.name !== 'desktop',
      'Chromium: safe-area insets are a DevTools override',
    );
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 0, right: 47, bottom: 21, left: 47 },
    });
    await switchFits(page);
  });
});
