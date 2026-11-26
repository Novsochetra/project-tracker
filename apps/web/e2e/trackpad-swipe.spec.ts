import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject, ticketRow } from './helpers';

// PT-258: a two-finger swipe on a Mac trackpad goes back and forward between screens. The
// browser's own swipe never reached the app: the stack's overscroll rule stops it.

const screenOf = (page: Page, path: string) => page.locator(`[data-stack-path="${path}"]`);

async function swipe(page: Page, dx: number): Promise<void> {
  // A pause first, so the swipe starts a gesture of its own.
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i += 1) await page.mouse.wheel(dx / 8, 0);
}

test.describe('trackpad swipe', () => {
  test.skip(({ isMobile }) => isMobile, 'phones have no trackpad');

  test('goes back and forward between screens', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Swipe me' }]);
    await page.goto('/');
    await page
      .getByRole('button', { name: /Mobile app/ })
      .last()
      .click();
    await ticketRow(page, 'MOB-1').click();
    await expect(page).toHaveURL(/\/p\/MOB\/1$/);
    await page.mouse.move(900, 400);

    await swipe(page, -400);
    await expect(page).toHaveURL(/\/p\/MOB$/);
    await swipe(page, -400);
    await expect(page).toHaveURL(/\/$/);
    await swipe(page, 400);
    await expect(page).toHaveURL(/\/p\/MOB$/);
    await expect(screenOf(page, '/p/MOB')).toBeVisible();
  });

  test('leaves a vertical scroll and a short swipe alone', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Stay here' }]);
    await page.goto('/p/MOB');
    await page.mouse.move(900, 400);
    await page.waitForTimeout(300);
    for (let i = 0; i < 8; i += 1) await page.mouse.wheel(-40, 120);
    await swipe(page, -60);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/p\/MOB$/);
  });
});
