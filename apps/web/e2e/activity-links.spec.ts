import { TrackerClient } from '@tracker/client';
import { expect, test } from './fixtures';
import { activity, readActionSheet, seedProject } from './helpers';
import { API_URL, WEB_PORT } from './ports';

const reviewer = new TrackerClient({
  baseUrl: API_URL,
  actor: { kind: 'agent', name: 'Reviewer' },
});

// Links point at the app this run serves, so opening one needs no outside site.
const board = `http://localhost:${WEB_PORT}/p/MOB`;

test.describe('links in activity', () => {
  test('URLs in comments, reports and reviews open in a new tab', async ({ page, api, agent }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Cache avatars' }]);
    await agent.addComment('MOB-1', { text: `Opened a PR: ${board} - preview at (${board}/1).` });
    await agent.claimTicket('MOB-1');
    await agent.submitForReview('MOB-1', {
      summary: `Preview: ${board}/1`,
      next: `Check ${board}`,
    });
    await reviewer.reviewTicket('MOB-1', {
      verdict: 'approved',
      rating: 4,
      summary: `Works, see ${board}/1.`,
    });

    await page.goto('/p/MOB/1');
    const log = activity(page);
    const commentLinks = log
      .locator('article')
      .filter({ hasText: 'Opened a PR' })
      .getByRole('link');
    await expect(commentLinks).toHaveCount(2);
    await expect(commentLinks.last()).toHaveAttribute('href', `${board}/1`);
    await expect(commentLinks.first()).toHaveAttribute('target', '_blank');
    await expect(commentLinks.first()).toHaveAttribute('rel', 'noopener noreferrer');
    const reportLinks = log
      .locator('article')
      .filter({ hasText: 'Claude report' })
      .getByRole('link');
    await expect(reportLinks).toHaveCount(2);
    const latest = page.getByRole('region', { name: 'Latest review' });
    await expect(latest.getByRole('link', { name: `${board}/1` })).toBeVisible();

    const popup = page.waitForEvent('popup');
    await commentLinks.first().click();
    const opened = await popup;
    await expect(opened).toHaveURL(board);
    await opened.close();

    await log.getByRole('button', { name: 'Comment options' }).click();
    await readActionSheet(page);
    await page.getByRole('button', { name: 'Edit comment' }).click();
    await expect(page.getByLabel('Edit comment')).toHaveValue(
      `Opened a PR: ${board} - preview at (${board}/1).`,
    );
  });

  // A summary of 90,000 closing brackets scrolled the screen 88px sideways at 375 in WebKit
  // (PT-55): WebKit laid out the one long text node wider than its box.
  test('a report with a very long unbroken run wraps without scrolling sideways', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Cache avatars' }]);
    const brackets = ')'.repeat(90_000);
    await api.applyReport({
      ticketKey: 'MOB-1',
      text: `TICKET: MOB-1\nSTATUS: done\nSUMMARY: https://x.dev/${brackets}`,
    });
    await page.goto('/p/MOB/1');
    const summary = activity(page).locator('dd').first();
    await expect(summary).toContainText(brackets.slice(0, 100));
    await summary.scrollIntoViewIfNeeded();
    const scroller = page.locator('[data-stack-path="/p/MOB/1"] [data-stack-scroller]');
    for (const box of [summary, scroller]) {
      const sizes = await box.evaluate((element) => [element.scrollWidth, element.clientWidth]);
      expect(sizes[0]).toBeLessThanOrEqual(sizes[1]!);
    }
    await expect(summary.getByRole('link', { name: 'https://x.dev/' })).toBeVisible();
  });
});
