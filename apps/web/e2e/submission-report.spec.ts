import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activity, seedProject, toast } from './helpers';

const reportCard = (page: Page, title: string) =>
  activity(page).locator('article').filter({ hasText: title });

test.describe('report cards', () => {
  test('an agent’s submission reads as Summary, Next and Files', async ({ page, api, agent }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash when rotating' }]);
    await agent.claimTicket('MOB-1');
    await agent.submitForReview('MOB-1', {
      summary: 'Fixed the rotation crash; added a rotation test.',
      files: 'src/profile/Header.tsx, src/profile/Header.test.tsx',
      next: 'Check on a real device in landscape',
    });

    await page.goto('/p/MOB/1');
    const card = reportCard(page, 'Claude report');
    await expect(card).toContainText('Submitted for review');
    await expect(card).not.toContainText('STATUS');
    await expect(card.getByRole('term')).toHaveText(['Summary', 'Next', 'Files']);
    await expect(card.getByRole('definition').first()).toHaveText(
      'Fixed the rotation crash; added a rotation test.',
    );
    await expect(card.getByRole('listitem')).toHaveText([
      'src/profile/Header.tsx',
      'src/profile/Header.test.tsx',
    ]);
    await expect(card.getByText('Check on a real device in landscape')).toBeVisible();
  });

  test('a pasted Claude Code report reads the same way and still moves the ticket', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error', status: 'In progress' }]);
    await page.goto('/p/MOB/1');
    await page.getByRole('button', { name: 'Paste report' }).click();
    const dialog = page.getByRole('dialog', { name: 'Paste Claude Code report' });
    await dialog
      .getByLabel('Report')
      .fill(
        [
          '**TICKET:** MOB-1',
          '**STATUS:** done',
          '**SUMMARY:** Added the inline error.',
          '**FILES:** `src/login/LoginForm.tsx`',
          '**NEXT:** none',
        ].join('\n'),
      );
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(toast(page, 'Report applied to 1 ticket')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Status/ })).toContainText('Need review');

    const card = reportCard(page, 'Claude Code report');
    await expect(card).toContainText('Submitted for review');
    await expect(card.getByRole('term')).toHaveText(['Summary', 'Files']);
    await expect(card.getByRole('listitem')).toHaveText(['src/login/LoginForm.tsx']);
    await expect(card).not.toContainText('none');
  });
});
