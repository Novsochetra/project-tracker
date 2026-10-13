import { expect, test } from './fixtures';
import { removeOwner, setOwner, signIn } from './owner';

test.describe('notifications', () => {
  test.afterEach(async ({ request }) => {
    await removeOwner(request);
  });

  // Push itself needs a real phone and a push service; here the sheet says where it works.
  test('the Account sheet has a switch for this device, off where push is not offered', async ({
    page,
    api,
  }, testInfo) => {
    void api;
    setOwner();
    await page.goto('/');
    await signIn(page);
    await page.getByRole('button', { name: 'Account' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Account' });
    const toggle = sheet.getByRole('switch', { name: 'Notifications on this device' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toBeDisabled();
    const note =
      testInfo.project.name === 'phone' ? /on the Home Screen/ : /can't show notifications/;
    await expect(sheet.getByText(note)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('account-notifications.png') });
  });
});
