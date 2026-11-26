import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activity, seedProject, settledScreenshot } from './helpers';

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

  test('a submission’s output reads as Output', async ({ page, api, agent }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Draft the launch post' }]);
    await agent.claimTicket('MOB-1');
    await agent.submitForReview('MOB-1', {
      summary: 'Wrote the launch post.',
      output: 'launch-post.md\nheader.png',
    });

    await page.goto('/p/MOB/1');
    const card = reportCard(page, 'Claude report');
    await expect(card.getByRole('term')).toHaveText(['Summary', 'Output']);
    await expect(card.getByRole('listitem')).toHaveText(['launch-post.md', 'header.png']);
  });

  test('files Claude attaches show on the ticket, and its output reads as Output', async ({
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

    await agent.submitForReview('MOB-1', {
      summary: 'Wrote the launch plan with its budget and a chart.',
      output: 'plan.md, budget.csv, chart.png',
      next: 'Pick a launch date',
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
