import type { Locator, Page } from '@playwright/test';
import { TrackerClient } from '@tracker/client';
import { formatShortDay, toYmd } from '@tracker/shared';
import { expect, isPhone, test } from './fixtures';
import { group, seedProject, settled, ticketRow } from './helpers';
import { API_URL } from './ports';

const reviewer = new TrackerClient({
  baseUrl: API_URL,
  actor: { kind: 'agent', name: 'Reviewer' },
});

const TITLE = 'Dark mode colors';
const DUE = toYmd(new Date());

const chipOf = (scope: Locator) => scope.locator('[data-verdict="changes_requested"]');

async function showView(page: Page, view: 'List' | 'Board'): Promise<void> {
  const views = page.getByRole('group', { name: 'Show tickets as' });
  await views.getByRole('button', { name: view }).click();
  await expect(views.getByRole('button', { name: view })).toHaveAttribute('aria-pressed', 'true');
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('The element is not rendered.');
  return found;
}

// The chip shares the phone row's second line with the key and the due date, under the title,
// clear of the avatar, without making the row taller or anything overflow.
async function expectOnSecondLine(page: Page, row: Locator): Promise<void> {
  // The group and the row rise in after the page loads, and each box below is a separate read, so
  // reads taken mid-rise disagree by how far the row moved between them (PT-81: 1.26px under load).
  await settled(row);
  const chip = await box(chipOf(row));
  const key = await box(row.getByText('MOB-1', { exact: true }));
  const title = await box(row.getByText(TITLE));
  const due = row.getByText(formatShortDay(DUE));
  const avatar = await box(row.getByRole('img', { name: 'Dara' }));
  expect(chip.width).toBeLessThanOrEqual(24);
  expect(Math.abs(chip.y + chip.height / 2 - (key.y + key.height / 2))).toBeLessThanOrEqual(1);
  expect(chip.y).toBeGreaterThanOrEqual(title.y + title.height);
  expect(chip.x).toBeGreaterThan(key.x + key.width);
  expect((await box(due)).x).toBeGreaterThan(chip.x + chip.width);
  expect(await due.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect((await box(due)).x + (await box(due)).width).toBeLessThanOrEqual(avatar.x);
  const plain = await box(ticketRow(page, 'MOB-2'));
  expect((await box(row)).height).toBeCloseTo(plain.height, 1);
  expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

test.describe('sent-back tickets', () => {
  test('are marked on their row and card until an agent submits them again', async ({
    page,
    api,
    agent,
  }, info) => {
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: TITLE, priority: 'high', assignee: 'Dara', due: DUE },
      { title: 'Fresh idea', priority: 'high', assignee: 'Dara', due: DUE },
    ]);
    await agent.claimTicket('MOB-1');
    await agent.submitForReview('MOB-1', { summary: 'Added dark colors.' });
    await reviewer.reviewTicket('MOB-1', {
      verdict: 'changes_requested',
      rating: 2,
      summary: 'Toggle rows still use light colors.',
    });

    await page.goto('/p/MOB');
    const row = ticketRow(page, 'MOB-1');
    await expect(group(page, 'To do')).toContainText(TITLE);
    await expect(row).toHaveAccessibleName(/^MOB-1 Dark mode colors Changes requested/);
    await expect(chipOf(row)).toBeVisible();
    await expect(chipOf(ticketRow(page, 'MOB-2'))).toHaveCount(0);
    if (isPhone(info.project.name)) {
      await expectOnSecondLine(page, row);
      await page.setViewportSize({ width: 320, height: 568 });
      await expectOnSecondLine(page, row);
      await page.setViewportSize({ width: 375, height: 812 });
    } else {
      await expect(row.getByText('Changes requested')).toBeVisible();
    }

    await showView(page, 'Board');
    const card = ticketRow(page, 'MOB-1');
    await expect(card.getByText('Changes requested')).toBeVisible();
    await expect(chipOf(ticketRow(page, 'MOB-2'))).toHaveCount(0);

    await agent.claimTicket('MOB-1');
    await expect(group(page, 'In progress')).toContainText(TITLE);
    await expect(chipOf(group(page, 'In progress'))).toHaveCount(1);

    await agent.submitForReview('MOB-1', { summary: 'Every row uses the dark colors now.' });
    await expect(group(page, 'Need review')).toContainText(TITLE);
    await expect(page.locator('[data-verdict]')).toHaveCount(0);

    await showView(page, 'List');
    await expect(group(page, 'Need review')).toContainText(TITLE);
    await expect(ticketRow(page, 'MOB-1')).not.toHaveAccessibleName(/Changes requested/);
    await expect(page.locator('[data-verdict]')).toHaveCount(0);
  });
});
