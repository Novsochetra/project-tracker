import type { Locator, Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { byRank } from '@tracker/shared';
import { expect, isPhone, test } from './fixtures';
import { group, seedProject, ticketRow, toast } from './helpers';

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

async function savedOrder(api: TrackerClient, statusName: string): Promise<string[]> {
  const board = await api.getBoard('MOB');
  const status = board.statuses.find((candidate) => candidate.name === statusName);
  return board.tickets
    .filter((ticket) => ticket.statusId === status?.id)
    .sort(byRank)
    .map((ticket) => ticket.key);
}

const shownOrder = (page: Page, statusName: string) =>
  group(page, statusName)
    .getByRole('button', { name: /^MOB-\d+\b/ })
    .evaluateAll((buttons) =>
      buttons.map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]),
    );

const seed = (api: TrackerClient) =>
  seedProject(api, 'Mobile app', 'MOB', [
    { title: 'Cache avatars' },
    { title: 'Dark mode colors' },
    { title: 'Crash on rotate' },
  ]);

test.describe('undo a status move', () => {
  test('a swiped row goes back to its status, between the same rows', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'Rows swipe on phones');
    await seed(api);
    await page.goto('/p/MOB');
    await expect.poll(() => shownOrder(page, 'To do')).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);

    await swipeRight(ticketRow(page, 'MOB-2'));
    await expect(toast(page, 'MOB-2 moved to In progress')).toBeVisible();
    await expect(group(page, 'In progress')).toContainText('Dark mode colors');
    await page.getByRole('button', { name: 'Undo' }).tap();

    await expect(toast(page, 'MOB-2 moved to To do')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
    await expect.poll(() => savedOrder(api, 'To do')).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
    await expect.poll(() => shownOrder(page, 'To do')).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
  });

  test('a card moved on the board with the keyboard goes back with ⌘Z', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Arrow-key moves are for keyboards');
    await seed(api);
    await page.goto('/p/MOB');
    await page
      .getByRole('group', { name: 'Show tickets as' })
      .getByRole('button', { name: 'Board' })
      .click();
    const handle = page.getByRole('button', { name: 'Move MOB-2. Drag, or use the arrow keys.' });
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(toast(page, 'MOB-2 moved to In progress')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect.poll(() => savedOrder(api, 'In progress')).toEqual(['MOB-2']);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(toast(page, 'MOB-2 moved to To do')).toBeVisible();
    await expect.poll(() => savedOrder(api, 'To do')).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
    await expect(handle).toBeFocused();
  });
});

// Rows sit behind the toast, above the bottom bar, at 375×812 and 320×568. Groups of six show
// all their rows.
const seedBehindToast = (api: TrackerClient) =>
  seedProject(api, 'Mobile app', 'MOB', [
    ...Array.from({ length: 6 }, (_, index) => ({ title: `Ticket ${index + 1}` })),
    ...Array.from({ length: 6 }, (_, index) => ({
      title: `Busy ticket ${index + 1}`,
      status: 'In progress',
    })),
  ]);

// The toast's entrance moves Undo; the taps go where it rests. An animation cancelled meanwhile
// rejects its promise, and has nothing left to wait for.
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );

const PHONE_SIZES = [
  { width: 375, height: 812 },
  { width: 320, height: 568 },
];

test.describe('a double tap on Undo', () => {
  // WebKit gave the second tap at the top of Undo's target to the row behind the toast (PT-67).
  test('at the top edge of its target runs Undo once and opens nothing behind it', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'Touch taps');
    await seedBehindToast(api);
    for (const size of PHONE_SIZES) {
      await page.setViewportSize(size);
      for (const offset of [4, 6, 8]) {
        const where = `${size.width}px, ${offset}px below the top`;
        await page.goto('/p/MOB');
        await swipeRight(ticketRow(page, 'MOB-6'));
        const undo = page.getByRole('button', { name: 'Undo' });
        await expect(undo, where).toBeVisible();
        await settled(page);
        const box = (await undo.boundingBox())!;
        const [x, y] = [box.x + box.width / 2, box.y + offset];

        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(150);
        await page.touchscreen.tap(x, y);
        await expect(toast(page, 'MOB-6 moved to To do'), where).toBeVisible();
        await page.waitForTimeout(500);
        await expect(page, where).toHaveURL(/\/p\/MOB$/);
        await expect(group(page, 'To do'), where).toContainText('Ticket 6');

        // Once the double tap is over, a tap there opens the row behind the toast again.
        await page.touchscreen.tap(x, y);
        await expect(page, where).toHaveURL(/\/p\/MOB\/\d+$/);
      }
    }
  });
});
