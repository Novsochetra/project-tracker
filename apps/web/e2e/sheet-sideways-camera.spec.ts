import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readActionSheet, seedProject, settled } from './helpers';

// PT-110: a phone turned sideways keeps the phone layout (PT-84), and its camera then sits at one
// side of the screen, where iOS reports a safe-area inset (47px at each side on an iPhone 13).
// Bottom sheets put Cancel, Create and their text under it. WebKit here can't report insets but
// Chromium can (DevTools' override), so this runs in Chromium at a sideways phone's size.

const WIDTH = 844;
const INSET = 47;

test.use({ viewport: { width: WIDTH, height: 390 }, hasTouch: true, isMobile: true });

async function turnSideways(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 0, right: INSET, bottom: 21, left: INSET },
  });
}

async function fromProjectMenu(page: Page, item: string): Promise<void> {
  await page.goto('/p/MOB');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: item }).click();
}

const sheets: Array<[string, string, (page: Page) => Promise<void>]> = [
  [
    'New ticket',
    'New ticket',
    async (page) => {
      await page.goto('/p/MOB');
      await page.getByRole('button', { name: 'New ticket', exact: true }).first().click();
    },
  ],
  ['quick capture', 'New ticket', (page) => page.goto('/?capture').then(() => undefined)],
  ['Statuses', 'Statuses', (page) => fromProjectMenu(page, 'Manage statuses')],
  ['Connect', 'Connect Claude Code', (page) => fromProjectMenu(page, 'Connect Claude Code')],
  [
    'Prompt',
    'Send to Claude Code',
    async (page) => {
      await page.goto('/p/MOB');
      await page.getByRole('button', { name: 'Send open tickets' }).click();
    },
  ],
  [
    'Report',
    'Paste Claude Code report',
    async (page) => {
      await page.goto('/p/MOB');
      await page.getByRole('button', { name: 'Paste report' }).click();
    },
  ],
];

// Where the sheet's buttons and fields begin and end, and where the sheet and its header line do.
const sidesOf = (sheet: Locator) =>
  sheet.evaluate((element) => {
    const boxes = [...element.querySelectorAll('button, input, textarea, select')]
      .map((control) => control.getBoundingClientRect())
      .filter((box) => box.width > 2 && box.height > 2);
    const header = element.querySelector('header')!.getBoundingClientRect();
    const panel = element.getBoundingClientRect();
    return {
      controls: [Math.min(...boxes.map((box) => box.left)), Math.max(...boxes.map((b) => b.right))],
      sheet: [panel.left, panel.right],
      header: [header.left, header.right],
    };
  });

test.describe('bottom sheets on a phone turned sideways', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Only Chromium reports safe-area insets',
  );

  for (const [name, label, open] of sheets) {
    test(`${name} keeps its buttons and text clear of the camera`, async ({ page, api }) => {
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
      await turnSideways(page);
      await open(page);
      const sheet = page.getByRole('dialog', { name: label });
      await expect(sheet).toBeVisible();
      await settled(sheet);
      const sides = await sidesOf(sheet);
      expect(sides.controls[0]).toBeGreaterThanOrEqual(INSET);
      expect(sides.controls[1]).toBeLessThanOrEqual(WIDTH - INSET);
      // The sheet and the line under its header still run to the screen's edges.
      expect(sides.sheet).toEqual([0, WIDTH]);
      expect(sides.header).toEqual([0, WIDTH]);
    });
  }
});
