import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject, toast } from './helpers';

const captureSheet = (page: Page) => page.getByRole('dialog', { name: 'New ticket' });

// The bottom bar's New ticket on phones, the title row's on desktop: both are the last one.
async function openCapture(page: Page) {
  await expect(page.getByRole('button', { name: /^Website/ }).last()).toBeVisible();
  await page.getByRole('button', { name: 'New ticket' }).last().click();
  await expect(captureSheet(page).getByLabel('Ticket title')).toBeFocused();
}

test('quick capture: typed text comes back after a reload until it is created', async ({
  page,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB');
  await seedProject(api, 'Website', 'WEB');
  await page.goto('/');
  await openCapture(page);
  const sheet = captureSheet(page);
  await sheet.getByLabel('Ticket title').fill('Captured idea before iOS stops the app');
  await sheet.getByLabel('Description', { exact: true }).fill('Steps inside');
  await sheet.getByRole('button', { name: /^Priority/ }).click();
  await page.getByRole('option', { name: 'High' }).click();

  await page.reload();
  await openCapture(page);
  await expect(sheet.getByLabel('Ticket title')).toHaveValue(
    'Captured idea before iOS stops the app',
  );
  await expect(sheet.getByLabel('Description', { exact: true })).toHaveValue('Steps inside');
  await expect(sheet.getByRole('button', { name: /^Priority/ })).toContainText('High');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(toast(page, 'WEB-1 created')).toBeVisible();

  await page.reload();
  await openCapture(page);
  await expect(sheet.getByLabel('Ticket title')).toHaveValue('');
  await expect(sheet.getByRole('button', { name: /^Priority/ })).toContainText('Medium');
});
