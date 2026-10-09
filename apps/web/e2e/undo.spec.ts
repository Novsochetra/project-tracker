import type { Locator, Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { byRank } from '@tracker/shared';
import { TOAST_SHIELD_MS } from '../src/components/Toast/toastStore';
import { expect, isPhone, isTablet, test } from './fixtures';
import {
  clearClicks,
  clickTimes,
  group,
  recordClicks,
  seedProject,
  settled,
  ticketRow,
  toast,
} from './helpers';

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

async function moveOnBoard(page: Page): Promise<Locator> {
  await page
    .getByRole('group', { name: 'Show tickets as' })
    .getByRole('button', { name: 'Board' })
    .click();
  const handle = page.getByRole('button', { name: 'Move MOB-2. Drag, or use the arrow keys.' });
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(toast(page, 'MOB-2 moved to In progress')).toBeVisible();
  return handle;
}

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
    const handle = await moveOnBoard(page);
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

const PHONE_SIZES = [
  { width: 375, height: 812 },
  { width: 320, height: 568 },
];

interface Box {
  y: number;
  height: number;
}

// Where a double tap's second tap lands on, or just past, Undo's 44px target.
const SECOND_TAPS: { name: string; y: (undo: Box) => number }[] = [
  // WebKit gave the second tap at the top of Undo's target to the row behind the toast (PT-67).
  ...[4, 6, 8].map((offset) => ({
    name: `${offset}px below its top`,
    y: (undo: Box) => undo.y + offset,
  })),
  // The target hung 1.5px below the band that catches the second tap, and a second tap that
  // drifted 2px past the target's top or bottom opened the row behind the toast (PT-87).
  { name: '1px above its bottom', y: (undo) => undo.y + undo.height - 1 },
  { name: '2px above it', y: (undo) => undo.y - 2 },
  { name: '2px below it', y: (undo) => undo.y + undo.height + 2 },
  // The band reached 9.5px past the target's top but 6.5px past its bottom, so a second tap
  // that drifted 8px below the target opened the row behind the toast (PT-92).
  { name: '8px above it', y: (undo) => undo.y - 8 },
  { name: '8px below it', y: (undo) => undo.y + undo.height + 8 },
];

// The first tap runs Undo, so it lands on the target, at its nearest edge to the second tap.
const onTarget = (undo: Box, y: number) =>
  Math.min(Math.max(y, undo.y + 1), undo.y + undo.height - 1);

test.describe('a double tap on Undo runs it once and opens nothing behind the toast', () => {
  for (const size of PHONE_SIZES) {
    for (const second of SECOND_TAPS) {
      test(`${size.width}px, second tap ${second.name}`, async ({ page, api }, info) => {
        test.skip(!isPhone(info.project.name), 'Touch taps');
        await seedBehindToast(api);
        await page.setViewportSize(size);
        await page.goto('/p/MOB');
        await swipeRight(ticketRow(page, 'MOB-6'));
        const undo = page.getByRole('button', { name: 'Undo' });
        await expect(undo).toBeVisible();
        // The toast's entrance moves Undo; the taps go where it rests.
        await settled(undo);
        const box = (await undo.boundingBox())!;
        const [x, y] = [box.x + box.width / 2, second.y(box)];

        await page.touchscreen.tap(x, onTarget(box, y));
        await page.waitForTimeout(150);
        await page.touchscreen.tap(x, y);
        await expect(toast(page, 'MOB-6 moved to To do')).toBeVisible();
        await page.waitForTimeout(500);
        await expect(page).toHaveURL(/\/p\/MOB$/);
        await expect(group(page, 'To do')).toContainText('Ticket 6');

        // Once the double tap is over, a tap there opens the row behind the toast again.
        await page.touchscreen.tap(x, y);
        await expect(page).toHaveURL(/\/p\/MOB\/\d+$/);
      });
    }
  }

  // The toast centers in the window, but a click in the sidebar right after Undo is no second
  // click on it (PT-92): it opens what is there, while the content column catches clicks.
  test('on desktop, a click in the sidebar right after Undo acts', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'The sidebar is on desktop');
    await page.addInitScript(recordClicks);
    await seed(api);
    await fillSidebar(api);
    const showUndo = async () => {
      await moveOnBoard(page);
      const undo = page.getByRole('button', { name: 'Undo' });
      await settled(undo);
      return (await undo.boundingBox())!;
    };

    await expectSidebarRightAfterUndo(page, showUndo, (x, y) => page.mouse.click(x, y));
    await expect(toast(page, 'MOB-2 moved to To do')).toBeVisible();
  });
});

// Projects past the end of the sidebar, so one sits beside the toast for a press there to open.
async function fillSidebar(api: TrackerClient): Promise<void> {
  for (let n = 1; n <= 30; n += 1) {
    await api.createProject({ name: `Side ${n}`, key: `SD${n}`, repo: '~/code/demo' });
  }
}

const SIDEBAR_X = 40;

interface Pressed {
  inTime: boolean;
  caught: boolean;
}

// Undo, then at once a press in the sidebar beside the toast, which opens the project there.
// `caught` tells whether the content column caught presses meanwhile, and `inTime`, by the page's
// clock, whether the second press came while it did: a busy page can take it later, where it
// proves nothing.
async function sidebarRightAfterUndo(
  page: Page,
  showUndo: () => Promise<Box & { x: number; width: number }>,
  press: (x: number, y: number) => Promise<void>,
): Promise<Pressed> {
  await page.goto('/p/MOB');
  const undo = await showUndo();
  const [x, y] = [undo.x + undo.width / 2, undo.y + undo.height / 2];
  const side = await page.evaluate(
    ({ x, y }) =>
      /^Side (\d+)/.exec(
        document.elementFromPoint(x, y)?.closest('button')?.textContent ?? '',
      )?.[1],
    { x: SIDEBAR_X, y },
  );
  expect(side, 'a project in the sidebar beside the toast').toBeDefined();
  await clearClicks(page);

  await press(x, y);
  const caught = await page.evaluate(
    ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="status"]')),
    { x: undo.x + undo.width + 40, y },
  );
  await press(SIDEBAR_X, y);

  await expect(page).toHaveURL(new RegExp(`/p/SD${side}$`));
  const [first, second] = await clickTimes(page);
  return { inTime: second! - first! < TOAST_SHIELD_MS, caught };
}

async function expectSidebarRightAfterUndo(
  ...args: Parameters<typeof sidebarRightAfterUndo>
): Promise<void> {
  let pressed = await sidebarRightAfterUndo(...args);
  for (let tries = 1; !pressed.inTime && tries < 3; tries += 1) {
    pressed = await sidebarRightAfterUndo(...args);
  }
  expect(pressed.inTime, `the sidebar's press within ${TOAST_SHIELD_MS} ms, in 3 tries`).toBe(true);
  expect(pressed.caught, 'the content column caught presses meanwhile').toBe(true);
}

// Four groups of six fill a tablet's list past the toast. MOB-6 moves on the board, where the
// keyboard moves cards, and back to the list, whose rows go behind the toast.
const seedTablet = (api: TrackerClient) =>
  seedProject(
    api,
    'Mobile app',
    'MOB',
    ['To do', 'In progress', 'Need review', 'Reviewed'].flatMap((status) =>
      Array.from({ length: 6 }, (_, index) => ({ title: `${status} ${index + 1}`, status })),
    ),
  );

async function undoOnList(page: Page): Promise<Box & { x: number; width: number }> {
  const view = page.getByRole('group', { name: 'Show tickets as' });
  await view.getByRole('button', { name: 'Board' }).click();
  await page.getByRole('button', { name: 'Move MOB-6. Drag, or use the arrow keys.' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(toast(page, 'MOB-6 moved to In progress')).toBeVisible();
  await view.getByRole('button', { name: 'List' }).click();
  const undo = page.getByRole('button', { name: 'Undo' });
  await settled(undo);
  return (await undo.boundingBox())!;
}

// Scrolls the list until a row's middle is at `y`, so a tap there that isn't caught opens it.
async function rowAt(page: Page, y: number): Promise<void> {
  await page.evaluate((y) => {
    const row = [...document.querySelectorAll('main button')].findLast((button) =>
      /^MOB-\d+/.test(button.textContent ?? ''),
    )!;
    let scroller = row.parentElement;
    const scrolls = (element: HTMLElement) =>
      element.scrollHeight > element.clientHeight &&
      /auto|scroll/.test(getComputedStyle(element).overflowY);
    while (scroller && !scrolls(scroller)) scroller = scroller.parentElement;
    const box = row.getBoundingClientRect();
    (scroller ?? document.scrollingElement!).scrollTop += box.top + box.height / 2 - y;
  }, y);
  await page.waitForTimeout(150);
}

// A tablet has the desktop layout and touch taps: the band catches a double tap's second tap
// in the content column, and the sidebar beside it takes taps as usual (PT-92, PT-106).
test('a double tap on Undo on a tablet opens nothing behind the toast @tablet', async ({
  page,
  api,
}, info) => {
  test.skip(!isTablet(info.project.name), 'Touch taps on the desktop layout');
  await page.addInitScript(recordClicks);
  await seedTablet(api);
  await fillSidebar(api);
  await page.goto('/p/MOB');
  for (const second of SECOND_TAPS) {
    const undo = await undoOnList(page);
    const [x, y] = [undo.x + undo.width / 2, second.y(undo)];
    await rowAt(page, y);

    await page.touchscreen.tap(x, onTarget(undo, y));
    await page.waitForTimeout(150);
    await page.touchscreen.tap(x, y);
    await expect(toast(page, 'MOB-6 moved to To do')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page, `second tap ${second.name}`).toHaveURL(/\/p\/MOB$/);

    await page.touchscreen.tap(x, y);
    await expect(page, `a later tap ${second.name} opens the row`).toHaveURL(/\/p\/MOB\/\d+$/);
    await page.goBack();
  }

  await expectSidebarRightAfterUndo(
    page,
    () => undoOnList(page),
    (x, y) => page.touchscreen.tap(x, y),
  );
  await expect(toast(page, 'MOB-6 moved to To do')).toBeVisible();
});
