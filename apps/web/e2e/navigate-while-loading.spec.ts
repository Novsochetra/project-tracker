import type { Page } from '@playwright/test';
import { PUSH_WAIT_LIMIT_MS } from '../src/navigation/pushWait';
import { expect, isPhone, test } from './fixtures';
import { activity, seedProject, ticketRow } from './helpers';

// PT-100: a push waiting for its screen's code had already added its history entry. A second
// project tapped meanwhile added one more, so Back from it showed the first; All projects left the
// cancelled project's entry behind; and Back while a ticket's code was on its way stayed on the
// project.

// The dev server sends each screen as its own module; holding one is a slow network's wait for
// that screen's chunk, with nothing else slowed down. Held before the first press, which starts
// loading every screen.
async function holdScreen(page: Page, file: string): Promise<() => void> {
  let release = () => undefined as void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/src/features/${file}*`, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

const PROJECT_SCREEN = 'project/ProjectScreen.tsx';
const TICKET_SCREEN = 'ticket/TicketScreen.tsx';

const historyLength = (page: Page) => page.evaluate(() => window.history.length);

const projectRow = (page: Page, name: string) =>
  page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}`) });

async function back(page: Page, phone: boolean): Promise<void> {
  if (phone) await page.getByRole('button', { name: 'Back to Projects' }).tap();
  else await page.goBack();
}

test.describe('a navigation while a screen’s code is on its way', () => {
  test.beforeEach(async ({ api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login screen' }]);
    await seedProject(api, 'Website', 'WEB', [{ title: 'Home page' }]);
  });

  test('a second project opens with one history entry, and one Back reaches Projects', async ({
    page,
  }, info) => {
    const phone = isPhone(info.project.name);
    const release = await holdScreen(page, PROJECT_SCREEN);
    await page.goto('/');
    await expect(projectRow(page, 'Website')).toBeVisible();
    const entries = await historyLength(page);

    await (phone ? projectRow(page, 'Mobile app').tap() : projectRow(page, 'Mobile app').click());
    await page.waitForTimeout(700);
    await (phone ? projectRow(page, 'Website').tap() : projectRow(page, 'Website').click());
    release();
    await expect(page.getByText('Home page')).toBeVisible();
    await expect(page).toHaveURL(/\/p\/WEB$/);
    expect(await historyLength(page)).toBe(entries + 1);

    await back(page, phone);
    await expect(page).toHaveURL(/\/$/);
    await expect(projectRow(page, 'Mobile app')).toBeVisible();
    await expect(page.getByText('Login screen')).toBeHidden();
  });

  test('All projects in the sidebar cancels the project and adds nothing', async ({
    page,
  }, info) => {
    test.skip(isPhone(info.project.name), 'The sidebar is on desktop');
    const release = await holdScreen(page, PROJECT_SCREEN);
    await page.goto('/');
    const sidebar = page.getByRole('complementary', { name: 'Projects' });
    await expect(sidebar.getByRole('button', { name: /^Mobile app/ })).toBeVisible();
    const entries = await historyLength(page);

    await sidebar.getByRole('button', { name: /^Mobile app/ }).click();
    await page.waitForTimeout(300);
    await sidebar.getByRole('button', { name: 'All projects' }).click();
    release();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Login screen')).toBeHidden();
    expect(await historyLength(page)).toBe(entries);
  });

  test('one Back while a ticket’s code is on its way reaches Projects', async ({ page }, info) => {
    const phone = isPhone(info.project.name);
    const release = await holdScreen(page, TICKET_SCREEN);
    await page.goto('/');
    await (phone ? projectRow(page, 'Mobile app').tap() : projectRow(page, 'Mobile app').click());
    const row = ticketRow(page, 'MOB-1');
    await expect(row).toBeVisible();
    const entries = await historyLength(page);

    await (phone ? row.tap() : row.click());
    await page.waitForTimeout(500);
    await back(page, phone);
    await expect(page).toHaveURL(/\/$/);
    await expect(projectRow(page, 'Mobile app')).toBeVisible();
    expect(await historyLength(page)).toBe(entries);

    release();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
    await expect(activity(page)).toBeHidden();
  });

  // PT-104: a chunk request that never answered kept the row pressed and the screen unchanged
  // until the browser gave up on it.
  test('a screen whose code stalls opens in its loading state at the time limit', async ({
    page,
  }, info) => {
    test.setTimeout(PUSH_WAIT_LIMIT_MS + 30_000);
    const phone = isPhone(info.project.name);
    const release = await holdScreen(page, PROJECT_SCREEN);
    await page.goto('/');
    const row = projectRow(page, 'Mobile app');
    await expect(row).toBeVisible();
    const entries = await historyLength(page);

    await (phone ? row.tap() : row.click());
    await page.waitForTimeout(PUSH_WAIT_LIMIT_MS / 2);
    await expect(page).toHaveURL(/\/$/);
    await expect(row).toHaveAttribute('data-opening');

    await expect(page).toHaveURL(/\/p\/MOB$/, { timeout: PUSH_WAIT_LIMIT_MS });
    const layer = page.locator('[data-stack-path="/p/MOB"]');
    await expect(layer.getByRole('status')).toBeVisible();
    await expect(page.locator('[data-opening]')).toHaveCount(0);
    expect(await historyLength(page)).toBe(entries + 1);

    release();
    await expect(page.getByText('Login screen')).toBeVisible();
    await expect(page).toHaveURL(/\/p\/MOB$/);
    expect(await historyLength(page)).toBe(entries + 1);
    await back(page, phone);
    await expect(page).toHaveURL(/\/$/);
    await expect(projectRow(page, 'Mobile app')).toBeVisible();
  });
});

// PT-108: on a phone the loading state of a screen whose code stalled was a spinner alone, with no
// nav bar or Back; and the browser's Forward to such a screen put that spinner in place of the
// whole stack until the code arrived.
test.describe('a screen whose code stalls', () => {
  test.beforeEach(async ({ api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login screen' }]);
  });

  const loadingLayer = (page: Page) => page.locator('[data-stack-path="/p/MOB"]');

  test('a first load straight into it offers Back on a phone', async ({ page }, info) => {
    const phone = isPhone(info.project.name);
    const release = await holdScreen(page, PROJECT_SCREEN);
    await page.goto('/p/MOB', { waitUntil: 'commit' });
    const main = page.getByRole('main');
    await expect(main.getByRole('status')).toBeVisible();
    if (phone) {
      await main.getByRole('button', { name: 'Back to Projects' }).tap();
      await expect(page).toHaveURL(/\/$/);
      await expect(projectRow(page, 'Mobile app')).toBeVisible();
    } else {
      const sidebar = page.getByRole('complementary', { name: 'Projects' });
      await expect(sidebar.getByRole('button', { name: /^Mobile app/ })).toBeVisible();
    }
    release();
  });

  test('Forward to it slides in its loading state at once, with Back on a phone', async ({
    page,
  }, info) => {
    test.setTimeout(PUSH_WAIT_LIMIT_MS + 30_000);
    const phone = isPhone(info.project.name);
    const release = await holdScreen(page, PROJECT_SCREEN);
    await page.goto('/');
    const row = projectRow(page, 'Mobile app');
    await (phone ? row.tap() : row.click());
    await expect(loadingLayer(page).getByRole('status')).toBeVisible({
      timeout: PUSH_WAIT_LIMIT_MS + 5_000,
    });
    if (phone) await loadingLayer(page).getByRole('button', { name: 'Back to Projects' }).tap();
    else await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(loadingLayer(page)).toHaveCount(0);

    await page.goForward();
    await expect(page).toHaveURL(/\/p\/MOB$/);
    await expect(loadingLayer(page).getByRole('status')).toBeVisible({ timeout: 1_000 });
    if (phone) {
      await expect(
        loadingLayer(page).getByRole('button', { name: 'Back to Projects' }),
      ).toBeVisible();
    }

    release();
    await expect(page.getByText('Login screen')).toBeVisible();
    await back(page, phone);
    await expect(page).toHaveURL(/\/$/);
  });
});
