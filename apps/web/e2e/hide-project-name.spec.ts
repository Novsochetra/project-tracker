import { expect, test } from './fixtures';
import { readActionSheet, seedProject, toast } from './helpers';

test('a project that hides its name shows its key on every screen but Edit project', async ({
  page,
  api,
}, info) => {
  await seedProject(api, 'Secret launch', 'SL', [{ title: 'Crash on login' }]);
  await page.goto('/p/SL');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Edit project' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit project' });
  await dialog.getByRole('switch', { name: 'Hide name' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page, 'Project updated')).toBeVisible();

  for (const path of ['/', '/p/SL', '/p/SL/1']) {
    await page.goto(path);
    await expect(page.getByText('Project SL').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Secret launch');
  }
  await page.screenshot({ path: info.outputPath('hidden-name-ticket.png') });

  await page.goto('/p/SL');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Edit project' }).click();
  await expect(dialog.getByLabel('Project name')).toHaveValue('Secret launch');
});
