import type { Page } from '@playwright/test';
import { TrackerClient } from '@tracker/client';
import { expect, isPhone, test } from './fixtures';
import { seedProject, toast } from './helpers';
import { API_URL } from './ports';

// The Latest review card left as soon as its Move to Done was tapped, so the second tap of a
// double tap hit what moved up into its place: Add images opened the photo picker, or the
// description took focus and opened the keyboard. With a long done name its check icon shrank.

const reviewer = new TrackerClient({
  baseUrl: API_URL,
  actor: { kind: 'agent', name: 'Reviewer' },
});

const latestReview = (page: Page) => page.getByRole('region', { name: 'Latest review' });
const cardDone = (page: Page) => latestReview(page).getByRole('button', { name: /^Move to/ });
const description = (page: Page) => page.getByLabel('Description', { exact: true });
const ticketBar = (page: Page) => page.locator('[data-stack-path="/p/MOB/1"] [data-bottom-bar]');

// As long as PT-42's description, which sat right under the card's button at 375×812.
const LONG_DESCRIPTION =
  'Steps to reproduce, what happened and what should happen instead. '.repeat(10);
const DESCRIPTIONS = {
  'a short description': 'Rotate twice.',
  'a long description': LONG_DESCRIPTION,
};
const LONG_DONE_NAME = 'Shipped to production and verified';

async function seedReviewed(api: TrackerClient, agent: TrackerClient, text: string) {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Cache avatars', description: text }]);
  await agent.claimTicket('MOB-1');
  await agent.submitForReview('MOB-1', { summary: 'Avatars are cached for 7 days.' });
  await reviewer.reviewTicket('MOB-1', { verdict: 'approved', rating: 4, summary: 'Works.' });
}

async function renameDone(api: TrackerClient, name: string) {
  const { statuses } = await api.getProject('MOB');
  const done = statuses.find((status) => status.category === 'done')!;
  await api.updateStatus(done.id, { name });
}

// The screen's entrance moves the button; the taps go where it rests.
const settled = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));

const PHONE_ONLY = 'Touch taps and phone widths';

test.describe('Latest review card: Move to Done', () => {
  for (const [kind, text] of Object.entries(DESCRIPTIONS)) {
    test(`a double tap moves the ticket and the second tap does nothing, with ${kind}`, async ({
      page,
      api,
      agent,
    }, info) => {
      test.skip(!isPhone(info.project.name), PHONE_ONLY);
      await seedReviewed(api, agent, text);
      let picker = false;
      page.on('filechooser', () => {
        picker = true;
      });
      await page.goto('/p/MOB/1');
      await expect(cardDone(page)).toBeInViewport();
      await settled(page);
      const box = (await cardDone(page).boundingBox())!;
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];

      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(150);
      await page.touchscreen.tap(x, y);
      await expect(toast(page, 'MOB-1 moved to Done')).toBeVisible();
      await expect(latestReview(page)).toHaveCount(0);
      await page.waitForTimeout(300);
      expect(picker).toBe(false);
      await expect(description(page)).not.toBeFocused();
      await expect(ticketBar(page)).not.toHaveAttribute('data-hidden');
      expect((await api.getTicket('MOB-1')).status.category).toBe('done');
    });
  }

  test('keeps the check icon whole with a long done name at 320 and 375', async ({
    page,
    api,
    agent,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await seedReviewed(api, agent, 'Rotate twice.');
    await renameDone(api, LONG_DONE_NAME);
    for (const size of [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/p/MOB/1');
      await expect(cardDone(page)).toHaveAccessibleName(`Move to ${LONG_DONE_NAME}`);
      const icon = await cardDone(page).locator('svg').boundingBox();
      expect(icon, `${size.width}px`).toMatchObject({ width: 16, height: 16 });
    }
  });
});
