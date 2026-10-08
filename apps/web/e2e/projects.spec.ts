import { expect, isPhone, test } from './fixtures';
import { readMenuConfirm, toast } from './helpers';

test.describe('projects', () => {
  test('starts empty and creates a project with a derived prefix', async ({ page, api }) => {
    void api;
    await page.goto('/');
    await expect(page.getByText('No projects yet')).toBeVisible();

    await page.getByRole('button', { name: 'New project' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New project' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create' })).toBeDisabled();
    await expect(
      dialog.getByText(
        'Tickets are numbered with a short prefix, like MOB-1. The repository is added to every Claude Code prompt.',
      ),
    ).toBeVisible();

    await dialog.getByLabel('Project name').fill('Mobile app');
    await expect(dialog.getByLabel('Ticket prefix')).toHaveAttribute('placeholder', 'MA');
    await expect(dialog.getByText(/Tickets will be numbered MA-1, MA-2 and so on\./)).toBeVisible();
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/p\/MA$/);
    await expect(toast(page, '“Mobile app” created')).toBeVisible();
  });

  test('typed prefixes are cleaned and kept unique', async ({ page, api }) => {
    await api.createProject({ name: 'First', key: 'MOB' });
    await page.goto('/');
    await page.getByRole('button', { name: 'New project' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New project' });
    await dialog.getByLabel('Project name').fill('Second');
    await dialog.getByLabel('Ticket prefix').fill('mob');
    await expect(dialog.getByText(/Tickets will be numbered MOB-1, MOB-2/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/p\/MOB2$/);
  });

  test('blank name shows the validation message on Enter', async ({ page, api }) => {
    void api;
    await page.goto('/');
    await page.getByRole('button', { name: 'New project' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New project' });
    await dialog.getByLabel('Project name').press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('Add a name to create the project.');
  });

  test('lists projects with open counts and opens one', async ({ page, api }, info) => {
    await api.createProject({ name: 'Website', key: 'WEB', description: 'Marketing site' });
    await page.goto('/');
    const row = page.getByRole('button', { name: /Website/ }).last();
    await expect(row).toContainText('WEB');
    await expect(row).toContainText('Marketing site');
    if (!isPhone(info.project.name)) {
      await expect(page.getByRole('complementary', { name: 'Projects' })).toContainText('Website');
    }
    await row.click();
    await expect(page).toHaveURL(/\/p\/WEB$/);
    await expect(page.getByText('No tickets yet')).toBeVisible();
  });

  test('edits and deletes a project from the options menu', async ({ page, api }, info) => {
    await api.createProject({ name: 'Website', key: 'WEB' });
    await page.goto('/p/WEB');
    await page.getByRole('button', { name: 'Project options' }).first().click();
    await page.getByRole('button', { name: 'Edit project' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit project' });
    await dialog.getByLabel('Project name').fill('Marketing site');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(toast(page, 'Project updated')).toBeVisible();

    await page.getByRole('button', { name: 'Project options' }).first().click();
    await page.getByRole('button', { name: 'Delete project' }).click();
    await readMenuConfirm(page);
    const confirmName = isPhone(info.project.name) ? 'Delete project' : 'Delete';
    await page.getByRole('button', { name: confirmName, exact: true }).last().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(toast(page, '“Marketing site” deleted')).toBeVisible();
    await expect(page.getByText('No projects yet')).toBeVisible();
  });

  test('a double-click on Edit project leaves its sheet open', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Phones show an action sheet');
    await api.createProject({ name: 'Website', key: 'WEB' });
    await page.goto('/p/WEB');
    const options = page.getByRole('button', { name: 'Project options' }).first();
    await options.click();
    await page.getByRole('button', { name: 'Edit project' }).dblclick();
    const dialog = page.getByRole('dialog', { name: 'Edit project' });
    await expect(dialog.getByLabel('Project name')).toBeFocused();
    await page.waitForTimeout(600);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(options).toBeFocused();
  });
});
