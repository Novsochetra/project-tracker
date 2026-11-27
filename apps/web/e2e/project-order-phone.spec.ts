import type { CDPSession, Locator, Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { expect, isPhone, test } from './fixtures';

// Enough projects that the phone's Projects list scrolls at 375×812.
const NAMES = [
  'Alpha',
  'Beta',
  'Gamma',
  'Delta',
  'Epsilon',
  'Zeta',
  'Eta',
  'Theta',
  'Iota',
  'Kappa',
  'Lambda',
  'Mu',
  'Nu',
  'Xi',
  'Omicron',
  'Pi',
];
const ROW_STEP = 60;

async function makeProjects(api: TrackerClient, names = NAMES): Promise<void> {
  for (const name of names) await api.createProject({ name });
}

const row = (page: Page, name: string) =>
  page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}\\b`) });

const shownOrder = (page: Page): Promise<string[]> =>
  page
    .getByRole('main')
    .locator('[data-reorder-row]')
    .evaluateAll((rows) => rows.map((each) => each.textContent?.trim().split(/\s+/)[0] ?? ''));

const savedOrder = async (api: TrackerClient): Promise<string[]> =>
  (await api.listProjects()).map((project) => project.name);

const scrollTop = (page: Page): Promise<number> =>
  page.locator('[data-stack-scroller]').evaluate((scroller) => scroller.scrollTop);

const orderSaved = (page: Page) =>
  page.waitForResponse(
    (response) => response.url().endsWith('/api/projects/order') && response.status() === 200,
  );

// Counts what changes in the list while a drag runs: a drag that re-rendered rows would add,
// remove or retext nodes.
function watchList(page: Page): Promise<void> {
  return page.evaluate(() => {
    const list = document.querySelector('main [data-reorder-row]')?.parentElement;
    const seen = { nodes: 0, styles: 0 };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes') seen.styles += 1;
        else seen.nodes += 1;
      }
    });
    if (list)
      observer.observe(list, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style'],
      });
    Object.assign(window, { listChanges: seen });
  });
}

const listChanges = (page: Page) =>
  page.evaluate(() => (window as unknown as { listChanges: { nodes: number } }).listChanges);

interface FingerDrag {
  hold: number;
  dy: number;
}

// Playwright can't drive a touch drag in WebKit, so the finger is synthetic touch pointer events.
async function fingerDown(source: Locator, { hold, dy }: FingerDrag) {
  const box = await source.boundingBox();
  if (!box) throw new Error('The row is not on screen.');
  const base = { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0 };
  const at = (y: number) => ({ ...base, clientX: box.x + box.width / 2, clientY: y });
  const start = box.y + box.height / 2;
  await source.dispatchEvent('pointerdown', at(start));
  await source.page().waitForTimeout(hold);
  for (let step = 1; step <= 12; step += 1) {
    await source.dispatchEvent('pointermove', at(start + (dy * step) / 12));
  }

  return () => source.dispatchEvent('pointerup', at(start + dy));
}

interface Point {
  x: number;
  y: number;
}

// A finger through Chromium's own input, which scrolls and pulls what a real finger would.
async function touchDrag(cdp: CDPSession, from: Point, to: Point, hold = 0): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  if (hold) await new Promise((resolve) => setTimeout(resolve, hold));
  for (let step = 1; step <= 12; step += 1) {
    const point = { x: from.x, y: from.y + ((to.y - from.y) * step) / 12 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function centerOf(source: Locator): Promise<Point> {
  const box = await source.boundingBox();
  if (!box) throw new Error('The row is not on screen.');

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('project order on the phone', () => {
  test('a finger that rests on a project lifts it, drags it by transforms, and the order stays', async ({
    page,
    browser,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'The phone list');
    await makeProjects(api, NAMES.slice(0, 3));
    await page.goto('/');
    await expect.poll(() => shownOrder(page)).toEqual(['Alpha', 'Beta', 'Gamma']);
    await page.screenshot({ path: info.outputPath('phone-before.png') });

    await watchList(page);
    const saved = orderSaved(page);
    const drop = await fingerDown(row(page, 'Alpha'), { hold: 500, dy: 2 * ROW_STEP + 20 });
    await expect(row(page, 'Alpha')).toHaveAttribute('data-dragging', '');
    await expect(row(page, 'Beta')).toHaveCSS('transform', `matrix(1, 0, 0, 1, 0, -${ROW_STEP})`);
    await page.screenshot({ path: info.outputPath('phone-drag.png') });
    expect((await listChanges(page)).nodes).toBe(0);
    await drop();
    await saved;

    await expect.poll(() => shownOrder(page)).toEqual(['Beta', 'Gamma', 'Alpha']);
    await expect(page).toHaveURL(/\/$/);
    await expect(row(page, 'Alpha')).not.toHaveAttribute('data-dragging');
    // The moved rows glide to their places; their rise doesn't play again over the glide.
    expect(
      await row(page, 'Alpha').evaluate((element) =>
        element.getAnimations().filter((animation) => animation instanceof CSSAnimation),
      ),
    ).toHaveLength(0);
    expect(await savedOrder(api)).toEqual(['Beta', 'Gamma', 'Alpha']);

    await page.reload();
    await expect.poll(() => shownOrder(page)).toEqual(['Beta', 'Gamma', 'Alpha']);
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const wide = await desktop.newPage();
    await wide.goto(new URL('/', page.url()).href);
    const sidebar = wide.getByRole('complementary', { name: 'Projects' });
    await expect
      .poll(() =>
        sidebar
          .locator('[data-reorder-row]')
          .evaluateAll((rows) => rows.map((each) => each.textContent?.trim().split(/\s+/)[0])),
      )
      .toEqual(['Beta', 'Gamma', 'Alpha']);
    await desktop.close();
  });

  test('a quick finger moves nothing, a lifted row dropped in place saves nothing, and a tap opens', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'The phone list');
    await makeProjects(api, NAMES.slice(0, 3));
    await page.goto('/');
    await expect.poll(() => shownOrder(page)).toEqual(['Alpha', 'Beta', 'Gamma']);
    let saves = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/projects/order')) saves += 1;
    });

    const swipe = await fingerDown(row(page, 'Alpha'), { hold: 0, dy: 2 * ROW_STEP });
    await page.waitForTimeout(500);
    await expect(row(page, 'Alpha')).not.toHaveAttribute('data-dragging');
    await swipe();
    const inPlace = await fingerDown(row(page, 'Beta'), { hold: 500, dy: 4 });
    await expect(row(page, 'Beta')).toHaveAttribute('data-dragging', '');
    await inPlace();

    await expect(row(page, 'Beta')).not.toHaveAttribute('data-dragging');
    expect(await shownOrder(page)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(saves).toBe(0);
    await page.waitForTimeout(400);
    await row(page, 'Gamma').tap();
    await expect(page).toHaveURL(/\/p\/GAM$/);
  });
});

test.describe('project order on a Chromium phone, with real touches', () => {
  test('a quick swipe scrolls, a pull refreshes, and a resting finger drags without scrolling', async ({
    browser,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Touch input through CDP needs Chromium');
    await makeProjects(api);
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect.poll(() => shownOrder(page)).toEqual(NAMES);
    const cdp = await context.newCDPSession(page);
    let saves = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/projects/order')) saves += 1;
    });

    const beta = await centerOf(row(page, 'Beta'));
    await touchDrag(cdp, beta, { x: beta.x, y: beta.y + 240 });
    await expect(page.getByRole('status').filter({ hasText: 'Refreshing' })).toBeAttached();
    await expect.poll(() => scrollTop(page)).toBe(0);
    await page.waitForTimeout(800);

    const kappa = await centerOf(row(page, 'Kappa'));
    await touchDrag(cdp, kappa, { x: kappa.x, y: kappa.y - 300 });
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(100);
    expect(saves).toBe(0);
    expect(await shownOrder(page)).toEqual(NAMES);

    await page.waitForTimeout(1000);
    const scrolled = await scrollTop(page);
    const saved = orderSaved(page);
    const iota = await centerOf(row(page, 'Iota'));
    await touchDrag(cdp, iota, { x: iota.x, y: iota.y - 2 * ROW_STEP - 20 }, 500);
    await saved;
    expect(await scrollTop(page)).toBe(scrolled);
    const moved = [...NAMES.slice(0, 6), 'Iota', ...NAMES.slice(6, 8), ...NAMES.slice(9)];
    await expect.poll(() => shownOrder(page)).toEqual(moved);
    await expect.poll(() => savedOrder(api)).toEqual(moved);
    await context.close();
  });

  test('a lifted row near the bottom edge scrolls the list', async ({ browser, api }, info) => {
    test.skip(isPhone(info.project.name), 'Touch input through CDP needs Chromium');
    await makeProjects(api);
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect.poll(() => shownOrder(page)).toEqual(NAMES);
    const cdp = await context.newCDPSession(page);

    const alpha = await centerOf(row(page, 'Alpha'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [alpha] });
    await page.waitForTimeout(500);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: alpha.x, y: 790 }],
    });
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect.poll(async () => (await shownOrder(page)).indexOf('Alpha')).toBeGreaterThan(6);
    await expect.poll(async () => (await savedOrder(api)).indexOf('Alpha')).toBeGreaterThan(6);
    await context.close();
  });
});
