import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activity, seedProject, settledScreenshot, toast } from './helpers';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

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

  test('files Claude attaches show on the ticket, and its OUTPUT reads as Output', async ({
    page,
    api,
    agent,
  }, testInfo) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Plan the launch' }]);
    await agent.claimTicket('MOB-1');
    const files: Array<[string, BlobPart, string]> = [
      ['plan.md', '# Launch plan', 'text/markdown'],
      ['budget.csv', 'month,amount\nNov,120', 'text/csv'],
      ['chart.png', PNG_1X1, 'image/png'],
    ];
    for (const [name, body, type] of files) {
      await agent.uploadAttachment(new Blob([body], { type }), name, 'MOB-1');
    }
    await agent.applyReport({
      ticketKey: 'MOB-1',
      text: [
        'TICKET: MOB-1',
        'STATUS: done',
        'SUMMARY: Wrote the launch plan with its budget and a chart.',
        'FILES: none',
        'OUTPUT: plan.md, budget.csv, chart.png',
        'NEXT: Pick a launch date',
      ].join('\n'),
    });

    await page.goto('/p/MOB/1');
    await expect(page.getByRole('button', { name: 'Open plan.md' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open budget.csv' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open image 1' })).toBeVisible();
    const card = reportCard(page, 'Claude report');
    await expect(card.getByRole('term')).toHaveText(['Summary', 'Next', 'Output']);
    await expect(card.getByRole('listitem')).toHaveText(['plan.md', 'budget.csv', 'chart.png']);
    await expect(card).not.toContainText('OUTPUT');
    // A phone folds a long report.
    if (testInfo.project.name === 'phone') {
      await card.getByRole('button', { name: 'Show more' }).click();
    }
    await card.getByText('chart.png').evaluate((item) => item.scrollIntoView({ block: 'center' }));
    await settledScreenshot(page, testInfo.outputPath('output-report.png'));
  });
});
