import type { Page, Request } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject, toast } from './helpers';

const SAVED_ON_PHONE = "Saved offline. It'll sync later.";

const captureSheet = (page: Page) => page.getByRole('dialog', { name: 'New ticket' });

type MarkedWindow = Window & { captureMarker?: string };

async function waitForProjects(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /^Mobile app/ }).last()).toBeVisible();
}

const isCreate = (request: Request) =>
  request.method() === 'POST' && /\/api\/projects\/[^/]+\/tickets$/.test(request.url());

async function capture(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'New ticket' }).last().click();
  await captureSheet(page).getByLabel('Ticket title').fill(title);
  await captureSheet(page).getByRole('button', { name: 'Create' }).click();
}

// What the app hears when the connection comes back.
const syncNow = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('online')));

test.describe('quick capture', () => {
  test('phone: captures from the bottom bar and stays on Projects', async ({ page, api }, info) => {
    test.skip(!isPhone(info.project.name), 'The New ticket bar is for phones.');
    await seedProject(api, 'Mobile app', 'MOB');
    await page.goto('/');
    await waitForProjects(page);

    await page.locator('[data-bottom-bar]').getByRole('button', { name: 'New ticket' }).click();
    const sheet = captureSheet(page);
    await expect(sheet.getByLabel('Ticket title')).toBeFocused();
    await expect(sheet.getByRole('button', { name: /^Project/ })).toContainText('Mobile app');
    await expect(sheet.getByRole('button', { name: /^Priority/ })).toContainText('Medium');
    await sheet.getByLabel('Ticket title').fill('Idea from the bus');
    await sheet.getByRole('button', { name: 'Create' }).click();

    await expect(toast(page, 'MOB-1 created')).toBeVisible();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    const { statuses } = await api.getProject('MOB');
    const tickets = await api.listTickets('MOB');
    expect(tickets).toEqual([
      expect.objectContaining({
        key: 'MOB-1',
        title: 'Idea from the bus',
        priority: 'medium',
        statusId: statuses[0]?.id,
      }),
    ]);

    await page.locator('[data-bottom-bar]').getByRole('button', { name: 'New ticket' }).click();
    await expect(captureSheet(page).getByLabel('Ticket title')).toHaveValue('');
    await expect(captureSheet(page).getByRole('button', { name: /^Project/ })).toContainText(
      'Mobile app',
    );
  });

  test('desktop: C opens quick capture from a project screen', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Keyboard shortcut on desktop.');
    await seedProject(api, 'Website', 'WEB');
    await page.goto('/p/WEB');
    await expect(page.getByText('No tickets yet')).toBeVisible();

    await page.keyboard.press('c');
    const sheet = captureSheet(page);
    await expect(sheet.getByLabel('Ticket title')).toBeFocused();
    await expect(sheet.getByLabel('Ticket title')).toHaveValue('');
    await page.keyboard.type('From the keyboard');
    await page.keyboard.press('Enter');

    await expect(toast(page, 'WEB-1 created')).toBeVisible();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/p\/WEB$/);
    await expect(page.getByRole('button', { name: /^WEB-1\b/ }).first()).toBeVisible();
  });

  test('offline: keeps the capture on the device and adds it once back online', async ({
    page,
    context,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB');
    await page.goto('/');
    await waitForProjects(page);
    await page.evaluate(() => {
      (window as MarkedWindow).captureMarker = 'same page';
    });

    await context.setOffline(true);
    await page.getByRole('button', { name: 'New ticket' }).last().click();
    await captureSheet(page).getByLabel('Ticket title').fill('Written in the tunnel');
    await captureSheet(page).getByRole('button', { name: 'Create' }).click();

    await expect(toast(page, SAVED_ON_PHONE)).toBeVisible();
    await expect(captureSheet(page)).toBeHidden();
    await expect(page.getByText('1 waiting to sync')).toBeVisible();
    expect(await api.listTickets('MOB')).toEqual([]);

    await context.setOffline(false);

    await expect(toast(page, '1 ticket added')).toBeVisible();
    await expect(page.getByText('1 waiting to sync')).toBeHidden();
    expect((await api.listTickets('MOB')).map((ticket) => ticket.title)).toEqual([
      'Written in the tunnel',
    ]);
    // The ticket came from reconnecting, not from a reload that synced on start.
    expect(await page.evaluate(() => (window as MarkedWindow).captureMarker)).toBe('same page');
  });

  test('a slow create in one tab is not sent again by another tab', async ({
    page,
    context,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB');
    await page.goto('/');
    await waitForProjects(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/projects/*/tickets', async (route) => {
      if (isCreate(route.request())) await held;
      await route.continue();
    });

    await capture(page, 'Slow idea');
    await expect(toast(page, SAVED_ON_PHONE)).toBeVisible({ timeout: 12_000 });
    // A second tab opens and syncs while the first tab's create is still out.
    const other = await context.newPage();
    const otherCreates: Request[] = [];
    other.on('request', (request) => {
      if (isCreate(request)) otherCreates.push(request);
    });
    await other.goto('/');
    await waitForProjects(other);
    await expect(other.getByText('1 waiting to sync')).toBeVisible();
    await syncNow(other);

    release();
    await expect(toast(page, '1 ticket added')).toBeVisible();
    await expect(other.getByText('1 waiting to sync')).toBeHidden();
    expect(otherCreates).toEqual([]);
    expect((await api.listTickets('MOB')).map((ticket) => ticket.title)).toEqual(['Slow idea']);
  });

  test('a long title survives the lookup before it is sent again', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB');
    await page.goto('/');
    await waitForProjects(page);
    await page.route('**/api/projects/*/tickets', (route) =>
      isCreate(route.request()) ? route.abort('connectionrefused') : route.continue(),
    );
    const title = `Long idea ${'x'.repeat(240)} end`;

    await capture(page, title);
    await expect(toast(page, SAVED_ON_PHONE)).toBeVisible();
    await page.unroute('**/api/projects/*/tickets');
    await syncNow(page);

    await expect(toast(page, '1 ticket added')).toBeVisible();
    expect((await api.listTickets('MOB')).map((ticket) => ticket.title)).toEqual([title]);
  });

  test('desktop: C leaves an open menu alone', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Keyboard shortcut on desktop.');
    await seedProject(api, 'Website', 'WEB');
    await page.goto('/p/WEB');
    await expect(page.getByText('No tickets yet')).toBeVisible();

    await page.getByRole('button', { name: 'Project options' }).click();
    const menu = page.getByRole('group', { name: 'Project options' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('c');
    // Nothing to wait for when nothing should happen: give the sheet time it would need to open.
    await page.waitForTimeout(400);
    await expect(captureSheet(page)).toBeHidden();
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.keyboard.press('c');
    await expect(captureSheet(page).getByLabel('Ticket title')).toBeFocused();
  });

  test('the app shortcut link opens quick capture and leaves a clean address', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB');
    await page.goto('/?capture');
    await expect(captureSheet(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
