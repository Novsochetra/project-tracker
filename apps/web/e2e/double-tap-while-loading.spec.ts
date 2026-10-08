import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject } from './helpers';

// PT-94: two taps on a project while its screen's code was on its way pushed it twice, so Back
// stayed on the project; and the tapped row showed nothing while the code loaded.

// The dev server sends the Project screen as its own module; holding it is a slow network's wait
// for the screen's chunk, with nothing else slowed down.
async function holdProjectScreen(page: Page): Promise<() => void> {
  let release = () => undefined as void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/src/features/project/ProjectScreen.tsx*', async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

const projectRow = (page: Page) =>
  page.getByRole('main').getByRole('button', { name: /^Mobile app/ });

const background = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor);

const pressedColor = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--fill)';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });

test.describe('a project opened while its screen’s code is on its way', () => {
  test('stays pressed, and a second tap adds nothing for Back', async ({ page, api }, info) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login screen' }]);
    await page.goto('/');
    const row = projectRow(page);
    await expect(row).toBeVisible();
    const rest = await background(row);
    const release = await holdProjectScreen(page);

    const phone = isPhone(info.project.name);
    await (phone ? row.tap() : row.click());
    await page.waitForTimeout(700);
    await (phone ? row.tap() : row.click());
    await page.mouse.move(0, 0);
    expect(await background(row)).toBe(await pressedColor(page));
    expect(await background(row)).not.toBe(rest);

    release();
    await expect(page.getByText('Login screen')).toBeVisible();
    await expect(page).toHaveURL(/\/p\/MOB$/);
    if (phone) await page.getByRole('button', { name: 'Back to Projects' }).tap();
    else await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(row).toBeVisible();
    await expect.poll(() => background(row)).toBe(rest);
  });
});

const SLOW_3G = {
  offline: false,
  latency: 2000,
  downloadThroughput: 50_000,
  uploadThroughput: 50_000,
};
const NO_THROTTLE = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };

test.describe('on a cold slow 3G phone (Chromium 375)', () => {
  test('a double tap on a project, then one Back, reaches Projects', async ({
    browser,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Network throttling needs Chromium');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login screen' }]);
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto('/');
    const row = projectRow(page);
    await expect(row).toBeVisible();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', SLOW_3G);

    await row.tap();
    await page.waitForTimeout(700);
    await row.tap();
    // The dev server sends the screen as a hundred modules, which slow 3G takes a minute over;
    // the taps are what needed the slow network.
    await cdp.send('Network.emulateNetworkConditions', NO_THROTTLE);
    await expect(page.getByText('Login screen')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Back to Projects' }).tap();
    await expect(page).toHaveURL(/\/$/);
    await expect(row).toBeVisible();
    await context.close();
  });
});
