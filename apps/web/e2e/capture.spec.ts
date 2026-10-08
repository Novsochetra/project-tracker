import type { Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject, toast } from './helpers';

const SAVED_ON_PHONE = "Saved offline. It'll sync later.";

const captureSheet = (page: Page) => page.getByRole('dialog', { name: 'New ticket' });

type MarkedWindow = Window & { captureMarker?: string };

async function waitForProjects(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /^Mobile app/ }).last()).toBeVisible();
}

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
