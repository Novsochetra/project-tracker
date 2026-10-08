import type { Locator, Page } from '@playwright/test';
import { TrackerClient } from '@tracker/client';
import { expect, isPhone, test } from './fixtures';
import { seedProject, toast } from './helpers';
import { API_URL } from './ports';

const reviewer = new TrackerClient({
  baseUrl: API_URL,
  actor: { kind: 'agent', name: 'Reviewer' },
});

const readySection = (page: Page) => page.getByRole('region', { name: 'Ready for you' });

const projectRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name} `) }).last();

// Playwright can't drive a touch drag in WebKit, so the swipe is synthetic touch pointer events.
async function swipeRight(row: Locator): Promise<void> {
  const box = await row.boundingBox();
  if (!box) throw new Error('The row is not on screen.');
  const start = box.x + 24;
  const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
  const at = (x: number) => ({ ...base, clientX: x, clientY: box.y + box.height / 2 });
  await row.dispatchEvent('pointerdown', at(start));
  for (let step = 1; step <= 12; step += 1) {
    await row.dispatchEvent('pointermove', at(start + step * 25));
  }
  await row.dispatchEvent('pointerup', at(start + 300));
}

test.describe('ready for you', () => {
  test('reviewed work shows on Projects and the owner moves it to Done', async ({
    page,
    api,
    agent,
  }, info) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Cache avatars' }]);
    await seedProject(api, 'Website', 'WEB', [{ title: 'Hero copy' }]);
    await page.goto('/');
    await expect(projectRow(page, 'Mobile app')).toContainText('1 open');
    await expect(readySection(page)).toHaveCount(0);

    expect((await agent.claimNext('MOB'))?.ticket.key).toBe('MOB-1');
    await agent.submitForReview('MOB-1', { summary: 'Avatars are cached for 7 days.' });
    await reviewer.reviewTicket('MOB-1', { verdict: 'approved', rating: 4, summary: 'Works.' });

    const section = readySection(page);
    const row = section.getByRole('button', { name: /^MOB-1\b/ });
    await expect(row).toContainText('Cache avatars');
    await expect(row).toContainText('Mobile app');
    await expect(row).toContainText('Approved');
    await expect(row.getByRole('img', { name: 'Rated 4 out of 5' })).toBeVisible();
    await expect(projectRow(page, 'Mobile app')).toContainText('1 ready');
    await expect(projectRow(page, 'Website')).not.toContainText('ready');

    if (isPhone(info.project.name)) {
      await swipeRight(row);
    } else {
      await row.hover();
      await section.getByRole('button', { name: 'Move MOB-1 to Done' }).click();
    }

    await expect(toast(page, 'MOB-1 moved to Done')).toBeVisible();
    await expect(section).toHaveCount(0);
    await expect(projectRow(page, 'Mobile app')).not.toContainText('ready');
    const detail = await api.getTicket('MOB-1');
    expect(detail.status.category).toBe('done');
    expect(detail.activity.at(-1)).toMatchObject({
      text: 'changed status to Done',
      actor: { kind: 'human' },
    });
  });

  test('a ready ticket opens from Projects', async ({ page, api, agent }) => {
    await seedProject(api, 'Website', 'WEB', [{ title: 'Pricing layout' }]);
    await agent.claimNext('WEB');
    await agent.submitForReview('WEB-1', { summary: 'Three plans side by side.' });
    await reviewer.reviewTicket('WEB-1', { verdict: 'approved', rating: 5, summary: 'Great.' });
    await page.goto('/');
    await readySection(page)
      .getByRole('button', { name: /^WEB-1\b/ })
      .click();
    await expect(page).toHaveURL(/\/p\/WEB\/1$/);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Pricing layout');
  });
});
