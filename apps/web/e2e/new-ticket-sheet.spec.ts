import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { openNewTicketIn, seedProject, toast } from './helpers';

// 150 characters: five lines at 375px.
const LONG_TITLE =
  'Let Claude group related tickets into one PR when they touch the same screen, and write a short summary of every change in the PR description for revi';

const showsAllText = (field: Locator) =>
  field.evaluate(
    (element) =>
      element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth,
  );

test.describe('new ticket sheet', () => {
  test('a long title wraps and stays in view while typing, and Enter creates it', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const title = page.getByRole('dialog', { name: 'New ticket' }).getByLabel('Ticket title');

    await title.fill(LONG_TITLE);
    expect(await showsAllText(title)).toBe(true);
    await title.press('Enter');
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
  });

  test('typed text comes back after a reload until the ticket is created', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    await sheet.getByLabel('Ticket title').fill('Offline mode for quick capture');
    await sheet.getByLabel('Description', { exact: true }).fill('Keep captures in a queue');

    await page.reload();
    await openNewTicketIn(page, 'To do');
    await expect(sheet.getByLabel('Ticket title')).toHaveValue('Offline mode for quick capture');
    await expect(sheet.getByLabel('Description', { exact: true })).toHaveValue(
      'Keep captures in a queue',
    );
    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();

    await page.reload();
    await openNewTicketIn(page, 'To do');
    await expect(sheet.getByLabel('Ticket title')).toHaveValue('');
  });
});
