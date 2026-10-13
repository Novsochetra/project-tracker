import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { openNewTicketIn, readActionSheet, resting, seedProject } from './helpers';

// PT-205: on an iPhone the Connect Claude Code sheet, scrolled down, stopped about a keyboard's
// height above the bottom of the screen with no keyboard up. Its body ended there, cutting the
// last command in half, and the screen behind showed under it. iOS can keep reporting the visual
// viewport a keyboard shortened after the keyboard has gone; here it always reports one.

const KEYBOARD = 335;

async function staleViewport(page: Page): Promise<void> {
  await page.addInitScript((keyboard) => {
    Object.defineProperty(VisualViewport.prototype, 'height', {
      configurable: true,
      get: () => window.innerHeight - keyboard,
    });
  }, KEYBOARD);
}

const bottomOf = async (locator: Locator): Promise<number> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Not rendered.');
  return Math.round(box.y + box.height);
};

async function openConnect(page: Page): Promise<Locator> {
  await page.goto('/p/MOB');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Connect Claude Code' }).click();
  const sheet = page.getByRole('dialog', { name: 'Connect Claude Code' });
  await expect(sheet.getByRole('button', { name: 'Copy CLI command' })).toBeAttached();
  return sheet;
}

const scrollToEnd = (sheet: Locator) =>
  sheet.evaluate((dialog) => {
    const scroller = [...dialog.querySelectorAll('*')].find(
      (element) => getComputedStyle(element).overflowY === 'auto',
    );
    if (!scroller) throw new Error('Nothing scrolls.');
    scroller.scrollTop = scroller.scrollHeight;
  });

const sheetAt = (page: Page, y: number) =>
  page.evaluate((top) => !!document.elementFromPoint(187, top)?.closest('[role=dialog]'), y);

test.beforeEach(async ({ api, page }, info) => {
  test.skip(!isPhone(info.project.name), 'Phone sheets follow the keyboard');
  await staleViewport(page);
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on launch' }]);
});

test('with no field in focus, a long sheet reaches the bottom and shows its end', async ({
  page,
}) => {
  const sheet = await openConnect(page);
  const height = page.viewportSize()?.height ?? 0;
  expect(await resting(() => bottomOf(sheet))).toBe(height);

  await scrollToEnd(sheet);
  const copy = sheet.getByRole('button', { name: 'Copy CLI command' });
  await expect(copy).toBeInViewport({ ratio: 1 });
  expect(await bottomOf(copy)).toBeLessThan(height - 16);
  expect(await sheetAt(page, height - 4)).toBe(true);
});

test('a focused field still lifts the sheet above the keyboard, and it drops back', async ({
  page,
}) => {
  await page.goto('/p/MOB');
  await openNewTicketIn(page, 'To do');
  const sheet = page.getByRole('dialog', { name: 'New ticket' });
  const height = page.viewportSize()?.height ?? 0;
  expect(await resting(() => bottomOf(sheet))).toBe(height);

  const title = sheet.getByLabel('Ticket title');
  await title.click();
  await expect.poll(() => bottomOf(sheet)).toBe(height - KEYBOARD);

  await title.evaluate((field) => field.blur());
  await expect.poll(() => bottomOf(sheet)).toBe(height);
});
