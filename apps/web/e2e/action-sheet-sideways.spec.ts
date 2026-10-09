import type { CDPSession, Locator, Page } from '@playwright/test';
import type { StatusCategory } from '@tracker/shared';
import { expect, test, usesPhoneLayout } from './fixtures';
import { readActionSheet, seedProject, settled, ticketRow, toast } from './helpers';

// PT-112: a phone turned sideways keeps the phone layout (PT-84) on a short screen: 390px on an
// iPhone 13, about 296px on an iPhone 17 Pro under Safari's address and tab bars. An action sheet
// taller than that was cut at the top (the project ••• sheet lost its caption and half of Edit
// project) and its rows couldn't scroll, so the cut rows were out of reach.

const SIDEWAYS = { width: 844, height: 390 };
const UNDER_SAFARI_BARS = { width: 874, height: 296 };
const SMALL_PHONE = { width: 320, height: 568 };

const EXTRA_STATUSES: Array<[string, StatusCategory]> = [
  ['Blocked', 'todo'],
  ['Waiting on design', 'in_progress'],
  ['QA', 'in_review'],
  ['Staging', 'reviewed'],
  ['Released', 'done'],
];

test.use({ viewport: SIDEWAYS, hasTouch: true, isMobile: true });

const cardOf = (sheet: Locator) => sheet.locator('[role="presentation"]');

const topOf = (sheet: Locator): Promise<number> =>
  sheet.evaluate((element) => element.getBoundingClientRect().top);

// The sheet slides up on a spring that runs in script, which settled() can't see; it has come
// to rest when two reads 100 ms apart agree.
async function restingTop(sheet: Locator): Promise<number> {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const top = await topOf(sheet);
        const still = top === last;
        last = top;
        return still;
      },
      { intervals: [100] },
    )
    .toBe(true);
  return last;
}

async function openProjectSheet(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Project options' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Project options' });
  await expect(sheet).toBeVisible();
  await settled(sheet);
  await restingTop(sheet);
  return sheet;
}

async function expectTopInSight(sheet: Locator, top: Locator): Promise<void> {
  await expect(top).toBeInViewport({ ratio: 1 });
  await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeInViewport({ ratio: 1 });
  expect(await topOf(sheet)).toBeGreaterThan(0);
}

// How far the rows scrolled to show their last one.
const scrollToEnd = (sheet: Locator): Promise<number> =>
  cardOf(sheet).evaluate((card) => {
    card.scrollTop = card.scrollHeight;
    return card.scrollTop;
  });

// Playwright can't drive a touch drag in WebKit, so the swipe is synthetic touch pointer events.
async function swipeLeft(row: Locator): Promise<void> {
  const box = await row.boundingBox();
  if (!box) throw new Error('The row is not on screen.');
  const start = box.x + box.width - 24;
  const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
  const at = (x: number) => ({ ...base, clientX: x, clientY: box.y + box.height / 2 });
  await row.dispatchEvent('pointerdown', at(start));
  for (let step = 1; step <= 12; step += 1) {
    await row.dispatchEvent('pointermove', at(start - step * 10));
  }
  await row.dispatchEvent('pointerup', at(start - 120));
}

interface Point {
  x: number;
  y: number;
}

// A finger's drag through the browser's own input, which scrolls what a real finger would.
async function touchDrag(cdp: CDPSession, from: Point, to: Point): Promise<void> {
  const steps = 12;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let step = 1; step <= steps; step += 1) {
    const point = {
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('action sheets on a short phone screen', () => {
  test('the project ••• sheet under Safari’s bars shows its caption and scrolls to Delete project', async ({
    page,
    api,
  }) => {
    await page.setViewportSize(UNDER_SAFARI_BARS);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB');
    test.skip(!(await usesPhoneLayout(page)), 'Action sheets are the phone layout');
    const sheet = await openProjectSheet(page);

    await expectTopInSight(sheet, sheet.getByText('Mobile app', { exact: true }));
    await expect(sheet.getByRole('button', { name: 'Edit project' })).toBeInViewport({ ratio: 1 });
    const remove = sheet.getByRole('button', { name: 'Delete project' });
    await expect(remove).not.toBeInViewport({ ratio: 1 });
    expect(await scrollToEnd(sheet)).toBeGreaterThan(0);
    await expect(remove).toBeInViewport({ ratio: 1 });
    await readActionSheet(page);
    await remove.click();
    await expect(sheet.getByText('Delete “Mobile app” and its 1 ticket?')).toBeInViewport({
      ratio: 1,
    });
    await expect(sheet.getByRole('button', { name: 'Delete project' })).toBeInViewport({
      ratio: 1,
    });
  });

  for (const size of [SIDEWAYS, SMALL_PHONE]) {
    test(`a row’s Status sheet with ten statuses scrolls to its last at ${size.width}×${size.height}`, async ({
      page,
      api,
    }) => {
      await page.setViewportSize(size);
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
      for (const [name, category] of EXTRA_STATUSES)
        await api.createStatus('MOB', { name, category });
      await page.goto('/p/MOB');
      test.skip(!(await usesPhoneLayout(page)), 'Rows swipe on phones');
      await swipeLeft(ticketRow(page, 'MOB-1'));
      // WebKit's hit test still finds the row while the actions spring open.
      await page.getByRole('button', { name: 'Status', exact: true }).dispatchEvent('click');
      const sheet = page.getByRole('dialog', { name: 'Status' });
      await expect(sheet).toBeVisible();
      await settled(sheet);
      await restingTop(sheet);

      await expectTopInSight(sheet, sheet.getByText('Move MOB-1 to'));
      await expect(sheet.getByRole('button', { name: 'In progress' })).toBeInViewport({ ratio: 1 });
      const last = sheet.getByRole('button', { name: 'Released' });
      await expect(last).not.toBeInViewport({ ratio: 1 });
      expect(await scrollToEnd(sheet)).toBeGreaterThan(0);
      await expect(last).toBeInViewport({ ratio: 1 });
      await readActionSheet(page);
      await last.click();
      await expect(toast(page, 'MOB-1 moved to Released')).toBeVisible();
    });
  }

  test('a drag on the rows scrolls them, and a pull down from their top closes the sheet', async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Real touch drags go through DevTools, in Chromium');
    await page.setViewportSize(UNDER_SAFARI_BARS);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB');
    const sheet = await openProjectSheet(page);
    const card = cardOf(sheet);
    const box = await card.boundingBox();
    if (!box) throw new Error('The sheet has no rows on screen.');
    const x = box.x + box.width / 2;
    const top = box.y + 20;
    const bottom = box.y + box.height - 20;
    const scrolled = () => card.evaluate((element) => element.scrollTop);
    const rest = await topOf(sheet);
    const cdp = await page.context().newCDPSession(page);

    await touchDrag(cdp, { x, y: bottom }, { x, y: top });
    await expect.poll(scrolled).toBeGreaterThan(40);
    expect(await topOf(sheet)).toBe(rest);

    const before = await scrolled();
    await touchDrag(cdp, { x, y: top }, { x, y: top + 30 });
    await expect.poll(scrolled).toBeLessThan(before);
    await expect(sheet).toBeVisible();
    expect(await topOf(sheet)).toBe(rest);

    await card.evaluate((element) => element.scrollTo({ top: 0 }));
    await touchDrag(cdp, { x, y: top }, { x, y: top + 200 });
    await expect(sheet).toBeHidden();
  });

  test('a sheet whose rows fit still follows a drag on them, either way', async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Real touch drags go through DevTools, in Chromium');
    await page.setViewportSize({ width: 375, height: 812 });
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB');
    const sheet = await openProjectSheet(page);
    const row = await sheet.getByRole('button', { name: 'Manage statuses' }).boundingBox();
    if (!row) throw new Error('The row is not on screen.');
    const start = { x: row.x + row.width / 2, y: row.y + row.height / 2 };
    const rest = await topOf(sheet);
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 6; step += 1) {
      const point = { x: start.x, y: start.y - step * 10 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    }
    expect(await topOf(sheet)).toBeLessThan(rest);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(sheet).toBeVisible();

    await touchDrag(cdp, start, { x: start.x, y: start.y + 300 });
    await expect(sheet).toBeHidden();
  });
});
