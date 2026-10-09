import type { Page } from '@playwright/test';
import { expect, isTablet, test } from './fixtures';
import { activity, seedProject } from './helpers';

// PT-84's review: the phone layout went by the window's height, and Android Chrome's keyboard
// shortens the window (index.html: interactive-widget=resizes-content). A tablet held sideways,
// 1280×712 under an 800px-tall screen, dropped to 1280×380 while typing and switched to the phone
// layout: the Details panel unmounted with the field being typed in, and the text went nowhere.
// The layout now goes by the screen, which the keyboard leaves alone. Playwright's setViewportSize
// resizes the screen too, so the keyboard here shortens only the window, through DevTools.

interface Size {
  width: number;
  height: number;
}

async function openKeyboard(page: Page, window: Size, screen: Size): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: window.width,
    height: window.height,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: screen.width,
    screenHeight: screen.height,
  });
}

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Projects' });
const details = (page: Page) => page.getByRole('complementary', { name: 'Ticket details' });
const chips = (page: Page) => page.getByRole('group', { name: 'Details' });

const TABLET_SCREEN = { width: 1280, height: 800 };
const TABLET_WINDOW = { width: 1280, height: 712 };

test.describe('an Android tablet held sideways, keyboard open', () => {
  test.use({
    viewport: TABLET_WINDOW,
    contextOptions: { screen: TABLET_SCREEN },
    isMobile: true,
    hasTouch: true,
  });

  test('keeps the desktop layout and the field being typed in', async ({ page, api }, info) => {
    test.skip(info.project.name !== 'desktop', 'Chromium: the keyboard is a DevTools override');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker', assignee: 'Dara' }]);
    await page.goto('/p/MOB/1');
    const assignee = details(page).getByLabel('Assignee', { exact: true });
    await assignee.tap();
    await expect(assignee).toBeFocused();

    await openKeyboard(page, { width: 1280, height: 380 }, TABLET_SCREEN);
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(380);
    await expect(sidebar(page)).toBeVisible();
    await expect(details(page)).toBeVisible();
    await expect(chips(page)).toHaveCount(0);
    await expect(assignee).toBeFocused();
    // The name sits at the field's right end, so the tap left the caret before it.
    await assignee.evaluate((field: HTMLInputElement) => field.setSelectionRange(4, 4));
    await page.keyboard.type(' Kim');
    await expect(assignee).toHaveValue('Dara Kim');
    expect(await page.evaluate(() => window.innerHeight)).toBe(380);
    await expect(details(page)).toBeVisible();

    await openKeyboard(page, TABLET_WINDOW, TABLET_SCREEN);
    await assignee.press('Enter');
    await expect(activity(page)).toContainText('You assigned the ticket to Dara Kim');
  });
});

test.describe('a phone held sideways, keyboard open', () => {
  // iOS reports the screen upright, whichever way the phone is held.
  const PHONE_SCREEN = { width: 390, height: 844 };
  test.use({
    viewport: { width: 844, height: 390 },
    contextOptions: { screen: PHONE_SCREEN },
    isMobile: true,
    hasTouch: true,
  });

  test('keeps the phone layout and the comment box', async ({ page, api }, info) => {
    test.skip(info.project.name !== 'desktop', 'Chromium: the keyboard is a DevTools override');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB/1');
    await expect(chips(page)).toBeVisible();
    const comment = page.getByLabel('Comment', { exact: true });
    await comment.scrollIntoViewIfNeeded();
    await comment.tap();
    await expect(comment).toBeFocused();

    await openKeyboard(page, { width: 844, height: 150 }, PHONE_SCREEN);
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(150);
    await expect(chips(page)).toHaveCount(1);
    await expect(sidebar(page)).toHaveCount(0);
    await expect(comment).toBeFocused();
    await page.keyboard.type('Typed sideways');
    await expect(comment).toHaveValue('Typed sideways');
    expect(await page.evaluate(() => window.innerHeight)).toBe(150);
    await expect(chips(page)).toHaveCount(1);
  });
});

test.describe('an iPad held sideways, keyboard open', () => {
  test.use({
    viewport: { width: 1024, height: 400 },
    contextOptions: { screen: { width: 768, height: 1024 } },
  });

  test('keeps the desktop layout @tablet', async ({ page, api }, info) => {
    test.skip(!isTablet(info.project.name), 'An iPad');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB/1');
    await expect(details(page)).toBeVisible();
    await expect(sidebar(page)).toBeVisible();
    await expect(chips(page)).toHaveCount(0);
  });
});
