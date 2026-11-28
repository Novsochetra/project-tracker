import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { removeOwner, setOwner, signIn } from './owner';

// The colors tokens.css gives the page in each appearance.
const PAGE = { light: 'rgb(255, 255, 255)', dark: 'rgb(0, 0, 0)' };

const appearance = (page: Page) => page.evaluate(() => document.documentElement.dataset.appearance);
const pageColor = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const themeColor = (page: Page) => page.locator('meta[name="theme-color"]').getAttribute('content');

async function openAccount(page: Page) {
  await page.getByRole('button', { name: 'Account' }).first().click();

  return page.getByRole('dialog', { name: 'Account' }).getByRole('group', { name: 'Appearance' });
}

test.describe('appearance', () => {
  test.afterEach(async ({ request }) => {
    await removeOwner(request);
  });

  test('follows the system, and its switch while the app is open', async ({ page, api }) => {
    void api;
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect.poll(() => pageColor(page)).toBe(PAGE.dark);
    expect(await themeColor(page)).toBe('#000000');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => appearance(page)).toBe('light');
    await expect.poll(() => pageColor(page)).toBe(PAGE.light);
    expect(await themeColor(page)).toBe('#ffffff');
  });

  test('remembers Light or Dark over the system, dark from the first paint', async ({
    page,
    api,
  }) => {
    void api;
    setOwner();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await signIn(page);
    const choices = await openAccount(page);
    await expect(choices.getByRole('button', { name: 'System' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await choices.getByRole('button', { name: 'Dark' }).click();
    await expect.poll(() => appearance(page)).toBe('dark');
    await expect.poll(() => pageColor(page)).toBe(PAGE.dark);

    // Read as the HTML arrives, before the app's own script: the page is never white first.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'interactive') return;

        (window as { firstPaint?: string }).firstPaint =
          document.documentElement.dataset.appearance;
      });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as { firstPaint?: string }).firstPaint)).toBe('dark');
    await expect.poll(() => pageColor(page)).toBe(PAGE.dark);

    const again = await openAccount(page);
    await expect(again.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await again.getByRole('button', { name: 'System' }).click();
    await expect.poll(() => appearance(page)).toBe('light');
  });
});
