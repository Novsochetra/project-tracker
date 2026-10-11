import { expect, test } from './fixtures';
import { seedProject } from './helpers';
import { OWNER, removeOwner, setOwner, signIn } from './owner';

const NEWCOMER = { name: 'Sam', email: 'sam@example.com', password: 'a long new password' };

test.describe('invites', () => {
  test.afterEach(async ({ request }) => {
    await removeOwner(request);
  });

  test('the owner invites someone, who starts with no projects and keeps theirs to themselves', async ({
    page,
    api,
  }, testInfo) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on launch' }]);
    setOwner();
    await page.goto('/');
    await signIn(page);
    await expect(page.getByText('Mobile app').first()).toBeVisible();

    await page.getByRole('button', { name: 'Account' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Account' });
    await sheet.getByRole('button', { name: 'Make an invite link' }).click();
    const card = sheet.getByRole('group', { name: 'New invite link' });
    await expect(card).toContainText('/invite#');
    await page.screenshot({ path: testInfo.outputPath('invite-made.png') });
    const link = (await card.locator('code').textContent()) ?? '';

    await page.goto(link);
    await expect(page.getByText(`You are signed in as ${OWNER.email}.`)).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    const form = page.getByRole('form', { name: 'Make your account' });
    await expect(form).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('invite-page.png') });
    await form.getByLabel('Name').fill(NEWCOMER.name);
    await form.getByLabel('Email').fill(NEWCOMER.email);
    await form.getByLabel(/^Password/).fill(NEWCOMER.password);
    await form.getByRole('button', { name: 'Make account' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('No projects yet')).toBeVisible();
    await page.getByRole('button', { name: 'New project' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New project' });
    await dialog.getByLabel('Project name').fill('Garden');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/p\/[A-Z0-9]+$/);
    const gardenKey = new URL(page.url()).pathname.split('/').pop() ?? '';

    await page.goto(link);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'This invite was already used. Sign in instead.',
    );
    await page.getByRole('button', { name: 'Go to sign in' }).click();
    await signIn(page);
    await expect(page.getByText('Mobile app').first()).toBeVisible();
    await expect(page.getByText('Garden')).toHaveCount(0);
    const garden = await page.evaluate(
      async (key) => (await fetch(`/api/projects/${key}`)).status,
      gardenKey,
    );
    expect(garden).toBe(404);
  });
});
