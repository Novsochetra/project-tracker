import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activity, seedProject, toast } from './helpers';

// PT-116: WebKit draws nothing added while a stylesheet loads until it's in, and in a build a
// part's stylesheet loads with its code: on an iPhone with a slow network a toast or a screen's
// loading state could stay unseen. The dev server brings CSS in scripts, so a held stylesheet
// stands in for a part's.

const HELD_SHEET = '/held-part.css';

async function holdSheet(page: Page): Promise<() => void> {
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**${HELD_SHEET}`, async (route) => {
    await gate;
    await route.fulfill({ contentType: 'text/css', body: '' });
  });
  return release;
}

const addHeldSheet = (page: Page) =>
  page.evaluate((href) => {
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = href;
    document.head.append(sheet);
  }, HELD_SHEET);

// Whether what the status with this text holds has a box in the next frame, read the way the page
// is drawn: asking for its box or taking a screenshot would make WebKit style it at once.
const drawnInNextFrame = (page: Page, statusText: string) =>
  page.evaluate(
    (text) =>
      new Promise<string>((resolve) => {
        const status = [...document.querySelectorAll('[role="status"]')].find((candidate) =>
          candidate.textContent?.includes(text),
        );
        const target = status?.firstElementChild;
        if (!target) return resolve('missing');
        const watch = new IntersectionObserver(([entry]) => {
          watch.disconnect();
          resolve(entry?.isIntersecting ? 'drawn' : 'not drawn');
        });
        watch.observe(target);
      }),
    statusText,
  );

const statusShown = (page: Page, text: string) =>
  page.waitForFunction(
    (wanted) =>
      [...document.querySelectorAll('[role="status"]')].some((status) =>
        status.textContent?.includes(wanted),
      ),
    text,
  );

// A trace's DOM snapshots would style it too.
test.use({ trace: 'off' });

test('a toast shows while a stylesheet loads', async ({ page, context, api }) => {
  await seedProject(api, 'Mobile app', 'MOB');
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Mobile app/ }).last()).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'New ticket' }).last().click();
  const sheet = page.getByRole('dialog', { name: 'New ticket' });
  await sheet.getByLabel('Ticket title').fill('Written in the tunnel');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(toast(page, "Saved offline. It'll sync later.")).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(toast(page, "Saved offline. It'll sync later.")).toBeHidden();

  // Offline, the sheet's request would fail at once; the capture waits for it instead.
  let sendCapture = () => undefined as void;
  const sheetAdded = new Promise<void>((resolve) => (sendCapture = resolve));
  await page.route('**/api/projects/MOB/tickets', async (route) => {
    await sheetAdded;
    await route.continue();
  });
  const release = await holdSheet(page);
  await context.setOffline(false);
  await addHeldSheet(page);
  sendCapture();
  await statusShown(page, '1 ticket added');
  expect(await drawnInNextFrame(page, '1 ticket added')).toBe('drawn');
  release();
});

test('a screen’s loading state shows on a first load while a stylesheet loads', async ({
  page,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on rotate' }]);
  let releaseCode = () => undefined as void;
  const code = new Promise<void>((resolve) => (releaseCode = resolve));
  await page.route(/\/src\/features\/ticket\/TicketScreen\.tsx(\?.*)?$/, async (route) => {
    await code;
    await route.continue();
  });
  const releaseSheet = await holdSheet(page);
  // In a build the deep link starts the screen's stylesheet as the app starts; a sheet held from
  // the page's start would hold the app's scripts too.
  await page.addInitScript((href) => {
    const watch = new MutationObserver(() => {
      if (!document.getElementById('root')?.firstChild) return;
      watch.disconnect();
      const sheet = document.createElement('link');
      sheet.rel = 'stylesheet';
      sheet.href = href;
      document.head.append(sheet);
    });
    watch.observe(document, { childList: true, subtree: true });
  }, HELD_SHEET);

  await page.goto('/p/MOB/1', { waitUntil: 'commit' });
  await statusShown(page, 'Loading');
  // Past the 400 ms a loading state waits before it fades in.
  await page.waitForTimeout(600);
  expect(await drawnInNextFrame(page, 'Loading')).toBe('drawn');

  releaseSheet();
  releaseCode();
  await expect(activity(page)).toBeVisible();
});
