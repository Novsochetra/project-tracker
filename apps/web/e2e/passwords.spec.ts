import { expect, test } from './fixtures';
import { OWNER, removeOwner, setOwner, signIn } from './owner';
import { API_URL } from './ports';

const NEW_PASSWORD = 'a brand new password';
const SAM = { name: 'Sam', email: 'sam@example.com', password: 'a long first password' };

test.describe('passwords', () => {
  test.afterEach(async ({ request }) => {
    await removeOwner(request);
  });

  test('a signed-in person changes their password, which signs out their other devices', async ({
    page,
    api,
    request,
  }, testInfo) => {
    void api;
    setOwner();
    await page.goto('/');
    await signIn(page);
    const phone = await request.post(`${API_URL}/api/session`, { data: OWNER });
    expect(phone.status()).toBe(200);

    await page.getByRole('button', { name: 'Account' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Account' });
    await sheet.getByRole('button', { name: 'Change password' }).click();
    const form = sheet.getByRole('form', { name: 'Change password' });
    await form.getByLabel('Current password').fill(OWNER.password);
    await form.getByLabel(/^New password/).fill(NEW_PASSWORD);
    await page.screenshot({ path: testInfo.outputPath('change-password.png') });
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password changed')).toBeVisible();
    await expect(form).toBeHidden();

    expect((await request.get(`${API_URL}/api/projects`)).status()).toBe(401);
    await page.reload();
    await expect(page.getByText('No projects yet')).toBeVisible();
    const login = await request.post(`${API_URL}/api/session`, {
      data: { email: OWNER.email, password: NEW_PASSWORD },
    });
    expect(login.status()).toBe(200);
    // The next test signs in with the usual password.
    setOwner();
  });

  test('the owner gives an invited person a reset link, which sets a new password once', async ({
    page,
    api,
    request,
  }, testInfo) => {
    void api;
    setOwner();
    await page.goto('/');
    await signIn(page);
    await expect(page.getByText('No projects yet')).toBeVisible();
    const secret = await page.evaluate(
      async () =>
        (
          (await (await fetch('/api/invites', { method: 'POST' })).json()) as {
            secret: string;
          }
        ).secret,
    );
    const accepted = await request.post(`${API_URL}/api/invites/accept`, {
      data: { secret, ...SAM },
    });
    expect(accepted.status()).toBe(201);

    await page.getByRole('button', { name: 'Account' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Account' });
    await sheet.getByRole('button', { name: 'Make a reset link for Sam' }).click();
    const card = sheet.getByRole('group', { name: 'New reset link' });
    await expect(card).toContainText('/reset-password#');
    await expect(sheet.getByRole('list', { name: 'People' })).toContainText('Reset link works');
    await page.screenshot({ path: testInfo.outputPath('reset-link-made.png') });
    const link = (await card.locator('code').textContent()) ?? '';

    await page.goto(link);
    const form = page.getByRole('form', { name: 'Set a new password' });
    await expect(form).toContainText(`For ${SAM.email}.`);
    await page.screenshot({ path: testInfo.outputPath('reset-page.png') });
    await form.getByLabel(/^New password/).fill(NEW_PASSWORD);
    await form.getByRole('button', { name: 'Set password' }).click();
    await expect(page.getByRole('heading', { name: 'Password set' })).toBeVisible();

    expect((await request.get(`${API_URL}/api/projects`)).status()).toBe(401);
    const login = await request.post(`${API_URL}/api/session`, {
      data: { email: SAM.email, password: NEW_PASSWORD },
    });
    expect(login.status()).toBe(200);

    await page.goto('/');
    await page.goto(link);
    await expect(page.getByRole('alert')).toHaveText(
      'This reset link was already used. Sign in, or ask the owner for a new one.',
    );
  });
});
