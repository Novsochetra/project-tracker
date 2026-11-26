import type { Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject } from './helpers';

const palette = (page: Page) => page.getByRole('dialog', { name: 'Search' });
const field = (page: Page) => page.getByRole('combobox', { name: 'Search projects and tickets' });

const fitsWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.beforeEach(async ({ api }) => {
  await seedProject(api, 'Mobile app', 'MOB', [
    { title: 'Crash on rotate', description: 'Open the camera and turn the phone.' },
    { title: 'Cache avatars', description: 'Rotate the keys every week, then sign in again.' },
  ]);
  await seedProject(api, 'Website', 'WEB', [{ title: 'Pricing layout' }]);
});

test('desktop: Command-K finds a description and Enter opens the ticket', async ({
  page,
}, info) => {
  test.skip(isPhone(info.project.name), 'The shortcut and sidebar button are for desktops.');
  await page.goto('/p/WEB');
  await expect(page.getByRole('button', { name: 'Search' })).toContainText(/⌘K|Ctrl K/);

  await page.keyboard.press('ControlOrMeta+k');
  await expect(field(page)).toBeFocused();
  await expect(palette(page).getByRole('group', { name: 'Projects' })).toBeVisible();
  await field(page).fill('rotate');
  const tickets = palette(page).getByRole('group', { name: 'Tickets' });
  await expect(tickets.getByRole('option')).toHaveCount(2);
  await expect(tickets.getByRole('option').nth(1)).toContainText('Rotate the keys every week');
  await expect(palette(page).getByText('to move')).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
  await palette(page).screenshot({ path: info.outputPath('search-desktop.png') });

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/p\/MOB\/2$/);
  await expect(palette(page)).toBeHidden();

  await page.keyboard.press('ControlOrMeta+k');
  await field(page).fill('web 1');
  await expect(palette(page).getByRole('option').first()).toContainText('WEB-1');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/p\/WEB\/1$/);
});

test('phone: the search button opens a sheet whose rows open tickets', async ({ page }, info) => {
  test.skip(!isPhone(info.project.name), 'The nav bar button is for phones.');
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(palette(page)).toBeVisible();
  await field(page).fill('rotate');
  await expect(palette(page).getByRole('option', { name: /Rotate the keys/ })).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
  await page.screenshot({ path: info.outputPath('search-phone.png') });

  await field(page).fill('crash');
  const row = palette(page).getByRole('option', { name: /MOB-1/ });
  await expect(row).toBeVisible();

  await row.click();
  await expect(page).toHaveURL(/\/p\/MOB\/1$/);
  await expect(palette(page)).toBeHidden();
});
