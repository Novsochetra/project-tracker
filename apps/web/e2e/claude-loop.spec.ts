import { expect, isPhone, test } from './fixtures';
import { activity, group, seedProject, ticketRow, toast } from './helpers';

const sendButton = (projectName: string) =>
  isPhone(projectName) ? 'Send to Claude' : 'Send to Claude Code';

test.describe('Claude Code copy/paste loop', () => {
  test('copies the ticket prompt and moves the ticket to In progress', async ({
    page,
    api,
    context,
    browserName,
  }, info) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium-only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Crash when rotating', description: 'Rotate twice.', priority: 'high' },
    ]);
    await page.goto('/p/MOB/1');
    await page.getByRole('button', { name: sendButton(info.project.name), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Send to Claude Code' });
    await expect(
      dialog.getByRole('switch', { name: 'Move to In progress when sent' }),
    ).toBeChecked();
    await dialog.getByRole('button', { name: 'Copy prompt' }).click();
    await expect(dialog.getByRole('button', { name: 'Copied' })).toBeVisible();
    await expect(toast(page, 'Prompt copied')).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Please work on ticket MOB-1 from my "Mobile app" project.');
    expect(copied).toContain('Priority: High · Status: To do');
    expect(copied).toContain('TICKET: MOB-1');

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(activity(page)).toContainText(
      'You sent the ticket to Claude Code and moved it to In progress',
    );
  });

  test('project prompt lists open tickets and says when there are none', async ({
    page,
    api,
  }, info) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Shipped', status: 'Done' }]);
    await page.goto('/p/MOB');
    const label = isPhone(info.project.name)
      ? 'Send open tickets'
      : 'Send open tickets to Claude Code';
    await page.getByRole('button', { name: label }).click();
    const dialog = page.getByRole('dialog', { name: 'Send to Claude Code' });
    await expect(dialog.getByText('There are no open tickets in this project.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copy prompt' })).toHaveCount(0);
  });

  test('pasting a report previews and applies status changes', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error', status: 'In progress' }]);
    await page.goto('/p/MOB');
    await page.getByRole('button', { name: 'Paste report' }).click();
    const dialog = page.getByRole('dialog', { name: 'Paste Claude Code report' });
    await dialog
      .getByLabel('Report')
      .fill(
        [
          '```',
          '**TICKET:** MOB-1',
          'STATUS: done',
          'SUMMARY: Added the inline error.',
          '```',
          'TICKET: MOB-9',
          'STATUS: done',
        ].join('\n'),
      );
    await expect(dialog.getByText('In progress → Need review')).toBeVisible();
    await expect(dialog.getByText('Skipped')).toBeVisible();
    await expect(dialog.getByText('No ticket with this ID')).toBeVisible();
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(toast(page, 'Report applied to 1 ticket')).toBeVisible();
    await expect(group(page, 'Need review')).toContainText('Login error');

    await ticketRow(page, 'MOB-1').click();
    await expect(activity(page)).toContainText('Claude Code report');
    await expect(activity(page)).toContainText(
      'changed status to Need review from a Claude Code report',
    );
  });
});
