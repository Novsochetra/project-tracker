import { expect, isPhone, test } from './fixtures';
import { seedProject } from './helpers';
import { OWNER, removeOwner, setOwner, signIn } from './owner';

test.describe('owner sign-in', () => {
  test.afterEach(async ({ request }) => {
    await removeOwner(request);
  });

  test('signs in on the page asked for, stays signed in, and signs out', async ({
    page,
    api,
    context,
  }, testInfo) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on launch' }]);
    setOwner();

    await page.goto('/p/MOB');
    await expect(page.getByRole('heading', { name: 'Sign in to Tracker' })).toBeVisible();
    await expect(page.getByText('Crash on launch')).toHaveCount(0);

    await signIn(page, 'not the password');
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');

    await page.getByLabel('Password').fill(OWNER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Crash on launch')).toBeVisible();
    await expect(page).toHaveURL(/\/p\/MOB$/);

    const cookie = (await context.cookies()).find(({ name }) => name === 'tracker_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

    await page.reload();
    await expect(page.getByText('Crash on launch')).toBeVisible();

    // In the Projects nav bar on a phone, at the foot of the sidebar on desktop.
    await page.goto('/');
    const account = page.getByRole('button', { name: 'Account' });
    if (!isPhone(testInfo.project.name)) {
      await expect(page.getByRole('complementary', { name: 'Projects' })).toContainText(
        OWNER.email,
      );
    }
    await account.click();
    const sheet = page.getByRole('dialog', { name: 'Account' });
    await expect(sheet).toContainText(`Signed in as ${OWNER.email}`);
    await sheet.getByRole('button', { name: 'Sign out', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Sign in to Tracker' })).toBeVisible();
    await expect(sheet).toBeHidden();
    const refused = await page.evaluate(async () => (await fetch('/api/projects')).status);
    expect(refused).toBe(401);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sign in to Tracker' })).toBeVisible();
  });

  test('moves from email to password with the keyboard', async ({ page, api }) => {
    void api;
    setOwner();
    await page.goto('/');
    await page.getByLabel('Email').fill(OWNER.email);
    await page.getByLabel('Email').press('Enter');
    await expect(page.getByLabel('Password')).toBeFocused();
    await page.getByLabel('Password').fill(OWNER.password);
    await page.getByLabel('Password').press('Enter');
    await expect(page.getByText('No projects yet')).toBeVisible();
  });
});
