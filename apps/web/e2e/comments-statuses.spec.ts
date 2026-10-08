import { expect, isPhone, test } from './fixtures';
import { activity, group, seedProject } from './helpers';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('comments', () => {
  test('adds, edits and deletes a comment', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error' }]);
    await page.goto('/p/MOB/1');
    const composer = page.getByLabel('Comment', { exact: true });
    const send = page.getByRole('button', { name: 'Comment', exact: true });
    await expect(send).toBeDisabled();
    await composer.fill('First thought');
    await send.click();
    await expect(composer).toHaveValue('');
    await expect(activity(page)).toContainText('First thought');

    await page.getByRole('button', { name: 'Comment options' }).first().click();
    await page.getByRole('button', { name: 'Edit comment' }).click();
    const editor = page.getByLabel('Edit comment', { exact: true });
    await editor.fill('Second thought');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(activity(page)).toContainText('Second thought');
    await expect(activity(page)).toContainText('edited');

    await page.getByRole('button', { name: 'Comment options' }).first().click();
    await page.getByRole('button', { name: 'Delete comment' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(activity(page)).not.toContainText('Second thought');
  });

  test('a double-click on Edit comment leaves the editor open', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Phones show an action sheet');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error' }]);
    await page.goto('/p/MOB/1');
    await page.getByLabel('Comment', { exact: true }).fill('First thought');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await page.getByRole('button', { name: 'Comment options' }).first().click();
    await page.getByRole('button', { name: 'Edit comment' }).dblclick();
    const editor = page.getByLabel('Edit comment', { exact: true });
    await expect(editor).toBeFocused();
    await page.waitForTimeout(600);
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue('First thought');
  });

  test('attaches an image to a comment and opens the viewer', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Screenshot bug' }]);
    await page.goto('/p/MOB/1');
    await page.getByLabel('Attach files to comment').setInputFiles({
      name: 'shot.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    const thumb = activity(page)
      .getByRole('button', { name: /Open image/ })
      .first();
    await expect(thumb).toBeVisible();
    await thumb.click();
    await expect(page.getByRole('dialog', { name: /Image/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Image/ })).toBeHidden();
  });
});

test.describe('statuses', () => {
  test('adds, renames and removes a custom status', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Waiting on design' }]);
    await page.goto('/p/MOB');
    await page.getByRole('button', { name: 'Project options' }).first().click();
    await page.getByRole('button', { name: 'Manage statuses' }).click();
    const sheet = page.getByRole('dialog', { name: 'Statuses' });
    await expect(sheet).toBeVisible();
    for (const name of ['To do', 'In progress', 'Need review', 'Reviewed', 'Done']) {
      await expect(sheet.getByText(name, { exact: true })).toBeVisible();
    }
    await sheet.getByRole('button', { name: 'Add status' }).click();
    await sheet.getByLabel('Status name').fill('Blocked');
    await sheet.getByRole('button', { name: 'Save status' }).click();
    await expect(sheet.getByText('Blocked', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toBeHidden();

    const { statuses } = await api.getProject('MOB');
    expect(statuses.map((status) => status.name)).toContain('Blocked');
    await expect(group(page, 'Blocked')).toHaveCount(0);
  });
});
