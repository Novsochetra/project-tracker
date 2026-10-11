import type { CDPSession, Locator, Page } from '@playwright/test';
import type { StatusCategory } from '@tracker/shared';
import { expect, test, usesPhoneLayout } from './fixtures';
import { readActionSheet, resting, seedProject, settled, ticketRow, toast } from './helpers';

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

const restingTop = (sheet: Locator): Promise<number> => resting(() => topOf(sheet));

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

// How much of the row the card of rows ends in shows, as a share of it: 0 when the card ends on a
// row line, so the list looks complete until scrolled (PT-117).
const shareOfCutRow = (sheet: Locator): Promise<number> =>
  cardOf(sheet).evaluate((card) => {
    const bottom = card.getBoundingClientRect().bottom;
    for (const row of card.querySelectorAll(':scope > button')) {
      const box = row.getBoundingClientRect();
      if (box.top < bottom - 0.5 && box.bottom > bottom + 0.5) {
        return (bottom - box.top) / box.height;
      }
    }
    return 0;
  });

async function expectRowCutMidway(sheet: Locator): Promise<void> {
  const share = await shareOfCutRow(sheet);
  expect(share).toBeGreaterThanOrEqual(0.3);
  expect(share).toBeLessThanOrEqual(0.7);
}

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

  // PT-117: at exactly 874×296 the card ended 2.5px into Delete project, and 20px taller it showed
  // most of it; either way the list looked complete.
  for (const height of [UNDER_SAFARI_BARS.height, 320, 340]) {
    test(`the project ••• sheet ends about halfway through a row at 874×${height}`, async ({
      page,
      api,
    }) => {
      await page.setViewportSize({ width: UNDER_SAFARI_BARS.width, height });
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
      await page.goto('/p/MOB');
      test.skip(!(await usesPhoneLayout(page)), 'Action sheets are the phone layout');
      const sheet = await openProjectSheet(page);
      await expectRowCutMidway(sheet);
      await expectTopInSight(sheet, sheet.getByText('Mobile app', { exact: true }));
      await expect(sheet.getByRole('button', { name: 'Edit project' })).toBeInViewport({
        ratio: 1,
      });
    });
  }

  // PT-129: ending 38% into Delete project already reads as going on, but the card was cut back to
  // the middle of the row above, about 47px lost.
  test('the project ••• sheet that ends a little short of halfway through a row keeps its height', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: UNDER_SAFARI_BARS.width, height: 315 });
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB');
    test.skip(!(await usesPhoneLayout(page)), 'Action sheets are the phone layout');
    const sheet = await openProjectSheet(page);
    expect(await cardOf(sheet).evaluate((card) => card.style.maxHeight)).toBe('');
    await expectRowCutMidway(sheet);
  });

  // PT-129: a caption that rewraps as the web font arrives moves the rows after the card is fitted.
  test('an open project ••• sheet ends partway through a row again when its caption grows', async ({
    page,
    api,
  }) => {
    await page.setViewportSize(UNDER_SAFARI_BARS);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB');
    test.skip(!(await usesPhoneLayout(page)), 'Action sheets are the phone layout');
    const sheet = await openProjectSheet(page);
    await sheet.getByText('Mobile app', { exact: true }).evaluate((caption) => {
      (caption as HTMLElement).style.paddingBottom = '42px';
    });
    await expect(() => expectRowCutMidway(sheet)).toPass({ timeout: 5_000 });
  });

  test('an open project ••• sheet ends about halfway through a row again when the screen changes', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: UNDER_SAFARI_BARS.width, height: 340 });
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await page.goto('/p/MOB');
    test.skip(!(await usesPhoneLayout(page)), 'Action sheets are the phone layout');
    const sheet = await openProjectSheet(page);
    await page.setViewportSize(UNDER_SAFARI_BARS);
    await restingTop(sheet);
    await expectRowCutMidway(sheet);
    await page.setViewportSize({ width: UNDER_SAFARI_BARS.height, height: 640 });
    await restingTop(sheet);
    await expect(sheet.getByRole('button', { name: 'Delete project' })).toBeInViewport({
      ratio: 1,
    });
    expect(await shareOfCutRow(sheet)).toBe(0);
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
      await expectRowCutMidway(sheet);
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

    // The rows scroll as the browser works through the drag's moves. Read while a busy machine
    // was still catching up, they went on past the read, and a pull of 30 px left them further
    // down than that (PT-150).
    const before = await resting(scrolled);
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
