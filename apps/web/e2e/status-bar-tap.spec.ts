import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject, ticketRow } from './helpers';

// PT-178: iOS scrolls only the document on a status-bar tap, and each screen scrolls in its own
// scroller. On iOS the window rests 1px down, and its scroll back to 0 is passed on to the top
// screen. Playwright can't tap the status bar, so the tests scroll the window the way iOS does.

const scroller = (page: Page, path: string) =>
  page.locator(`[data-stack-path="${path}"] [data-stack-scroller]`);
const scrollTopOf = (page: Page, path: string) =>
  scroller(page, path).evaluate((element) => element.scrollTop);
const scrollScreen = (page: Page, path: string, top: number) =>
  scroller(page, path).evaluate((element, y) => element.scrollTo({ top: y }), top);
const windowY = (page: Page) => page.evaluate(() => window.scrollY);
const tapStatusBar = (page: Page) => page.evaluate(() => window.scrollTo(0, 0));

const DESCRIPTION =
  'A line of description that makes the ticket screen long enough to scroll. '.repeat(40);

async function openLongProject(page: Page, api: Parameters<typeof seedProject>[0]): Promise<void> {
  const tickets = Array.from({ length: 30 }, (_, i) => ({
    title: `Ticket number ${i + 1}`,
    description: DESCRIPTION,
  }));
  await seedProject(api, 'Mobile app', 'MOB', tickets);
  await page.goto('/p/MOB');
  await page.getByRole('button', { name: /^Show \d+ more/ }).click();
}

test.describe('the iOS status-bar tap', () => {
  test.skip(({ browserName }) => browserName !== 'webkit', 'the phone project is an iPhone');

  test('scrolls the top screen to the top and leaves the one below where it was', async ({
    page,
    api,
  }) => {
    await openLongProject(page, api);
    await expect.poll(() => windowY(page)).toBe(1);
    expect(
      await page.evaluate(() => document.getElementById('root')!.getBoundingClientRect().top),
    ).toBe(0);

    await scrollScreen(page, '/p/MOB', 600);
    await tapStatusBar(page);
    await expect.poll(() => scrollTopOf(page, '/p/MOB')).toBe(0);
    await expect.poll(() => windowY(page)).toBe(1);

    await scrollScreen(page, '/p/MOB', 600);
    await ticketRow(page, 'MOB-20').click();
    await expect(page.locator('[data-stack-path="/p/MOB/20"]')).toBeVisible();
    await scrollScreen(page, '/p/MOB/20', 400);
    await tapStatusBar(page);
    await expect.poll(() => scrollTopOf(page, '/p/MOB/20')).toBe(0);
    expect(await scrollTopOf(page, '/p/MOB')).toBe(600);

    await page.goBack();
    await expect(page.locator('[data-stack-path="/p/MOB/20"]')).toHaveCount(0);
    expect(await scrollTopOf(page, '/p/MOB')).toBe(600);
    await tapStatusBar(page);
    await expect.poll(() => scrollTopOf(page, '/p/MOB')).toBe(0);
  });

  test('leaves the screen where it was while a sheet opens and closes', async ({ page, api }) => {
    await openLongProject(page, api);
    await scrollScreen(page, '/p/MOB', 600);
    await page.getByRole('button', { name: 'Project options' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toHaveCount(0);
    expect(await scrollTopOf(page, '/p/MOB')).toBe(600);
    await expect.poll(() => windowY(page)).toBe(1);

    await tapStatusBar(page);
    await expect.poll(() => scrollTopOf(page, '/p/MOB')).toBe(0);
  });
});

test.describe('on desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('the page keeps no scroll range and the screen keeps its place', async ({ page, api }) => {
    await openLongProject(page, api);
    await scrollScreen(page, '/p/MOB', 600);
    const sizes = await page.evaluate(() => [
      document.documentElement.scrollHeight,
      window.innerHeight,
      window.scrollY,
    ]);
    expect(sizes).toEqual([sizes[1], sizes[1], 0]);
    await tapStatusBar(page);
    await page.waitForTimeout(300);
    expect(await scrollTopOf(page, '/p/MOB')).toBe(600);
  });
});
