import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readActionSheet, toast } from './helpers';

const NAME = 'Secret launch';
const DESCRIPTION = 'The new payments app';
const REPO = '~/code/secret-launch';

async function openEditProject(page: Page) {
  await page.goto('/p/SL');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Edit project' }).click();
  return page.getByRole('dialog', { name: 'Edit project' });
}

test('a project that hides its name shows its key on every screen but Edit project', async ({
  page,
  api,
}, info) => {
  await api.createProject({ name: NAME, key: 'SL', description: DESCRIPTION, repo: REPO });
  await api.createTicket('SL', { title: 'Crash on login' });
  const edit = await openEditProject(page);
  await edit.getByRole('switch', { name: 'Hide name' }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page, 'Project updated')).toBeVisible();

  for (const path of ['/', '/p/SL', '/p/SL/1']) {
    await page.goto(path);
    await expect(page.getByText('Project SL').filter({ visible: true }).first()).toBeVisible();
    for (const text of [NAME, DESCRIPTION, REPO]) {
      await expect(page.locator('body')).not.toContainText(text);
    }
    await expect(page.locator(`[title*="${REPO}"]`)).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath('hidden-name-ticket.png') });

  const again = await openEditProject(page);
  await expect(again.getByLabel('Project name')).toHaveValue(NAME);
  await expect(again.getByLabel('Description')).toHaveValue(DESCRIPTION);
});
