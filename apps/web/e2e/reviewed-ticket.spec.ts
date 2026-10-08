import type { Page } from '@playwright/test';
import { TrackerClient } from '@tracker/client';
import { expect, isPhone, test } from './fixtures';
import { activity, seedProject, toast } from './helpers';
import { API_URL } from './ports';

const reviewer = new TrackerClient({
  baseUrl: API_URL,
  actor: { kind: 'agent', name: 'Reviewer' },
});

const latestReview = (page: Page) => page.getByRole('region', { name: 'Latest review' });
const bottomBar = (page: Page) => page.locator('[data-bottom-bar]');

test.describe('reviewed ticket', () => {
  test('shows the review first and moves to Done in one tap', async ({
    page,
    api,
    agent,
  }, info) => {
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Cache avatars', description: 'Cache them on disk for a week.' },
    ]);
    await agent.claimTicket('MOB-1');
    await agent.submitForReview('MOB-1', {
      summary: 'Avatars are cached for 7 days.',
      files: 'src/avatar.ts',
    });
    await reviewer.reviewTicket('MOB-1', {
      verdict: 'approved',
      rating: 4,
      summary: 'Works; tests cover expiry.',
    });

    await page.goto('/p/MOB/1');
    const latest = latestReview(page);
    await expect(latest).toContainText('Reviewer reviewed');
    await expect(latest).toContainText('Approved');
    await expect(latest.getByRole('img', { name: 'Rated 4 out of 5' })).toBeInViewport();
    await expect(latest.getByText('Works; tests cover expiry.')).toBeInViewport();

    const move = isPhone(info.project.name)
      ? bottomBar(page).getByRole('button', { name: 'Move to Done' })
      : latest.getByRole('button', { name: 'Move to Done' });
    await expect(move).toBeInViewport();
    await move.click();
    await expect(toast(page, 'MOB-1 moved to Done')).toBeVisible();
    await expect(latest).toHaveCount(0);
    await expect(activity(page)).toContainText('You changed status to Done');
    expect((await api.getTicket('MOB-1')).status.category).toBe('done');
  });

  test('a sent-back ticket shows why at the top until it is submitted again', async ({
    page,
    api,
    agent,
  }, info) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Dark mode colors' }]);
    await agent.claimTicket('MOB-1');
    await agent.submitForReview('MOB-1', { summary: 'Added dark colors.' });
    await reviewer.reviewTicket('MOB-1', {
      verdict: 'changes_requested',
      rating: 2,
      summary: 'Toggle rows still use light colors.',
    });

    await page.goto('/p/MOB/1');
    const latest = latestReview(page);
    await expect(latest).toContainText('Changes requested');
    await expect(latest.getByText('Toggle rows still use light colors.')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Move to Done' })).toHaveCount(0);
    if (isPhone(info.project.name)) {
      await expect(bottomBar(page).getByRole('button', { name: 'Send to Claude' })).toBeVisible();
    }

    await agent.claimTicket('MOB-1');
    await expect(page.getByRole('button', { name: /^Status/ })).toContainText('In progress');
    await expect(latest).toContainText('Changes requested');
    await agent.submitForReview('MOB-1', { summary: 'Every row uses the dark colors now.' });
    await expect(page.getByRole('button', { name: /^Status/ })).toContainText('Need review');
    await expect(latest).toHaveCount(0);
  });
});
