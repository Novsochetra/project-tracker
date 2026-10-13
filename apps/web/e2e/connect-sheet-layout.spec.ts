import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { readActionSheet, seedProject, settled } from './helpers';

// PT-183: on a desktop Connect Claude Code ran off the bottom of the window with its header, and
// long commands wrapped over four lines. It now fits the window with Close always in view, puts
// the overview beside the commands, and keeps each command on one line that scrolls sideways.

const RAILWAY = 'https://project-tracker-production-aa4f.up.railway.app';

// The tracker people use is on Railway, whose long address has to fit the narrow column.
async function onRailway(page: Page): Promise<void> {
  await page.route('**/api/meta', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), serverUrl: RAILWAY } });
  });
}

async function openConnect(page: Page): Promise<Locator> {
  await page.goto('/p/MOB');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Connect Claude Code' }).click();
  const sheet = page.getByRole('dialog', { name: 'Connect Claude Code' });
  await expect(sheet.getByRole('button', { name: 'Copy MCP command' })).toBeVisible();
  await settled(sheet);
  return sheet;
}

const box = async (locator: Locator) => {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Not rendered.');
  return rect;
};

const overflowsSideways = (code: Locator) =>
  code.evaluate((element) => element.scrollWidth > element.clientWidth);

const lineCount = (code: Locator) =>
  code.evaluate((element) =>
    Math.round(
      (element.clientHeight -
        parseFloat(getComputedStyle(element).paddingTop) -
        parseFloat(getComputedStyle(element).paddingBottom)) /
        parseFloat(getComputedStyle(element).lineHeight),
    ),
  );

const mcpCommand = (sheet: Locator) =>
  sheet.getByRole('listitem').filter({ hasText: 'claude mcp add tracker' }).locator('code');

test.beforeEach(async ({ api }) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on launch' }]);
});

for (const height of [800, 700]) {
  test(`desktop ${height}px tall: the sheet fits the window and Close stays in view`, async ({
    page,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Desktop layout');
    await page.setViewportSize({ width: 1280, height });
    await onRailway(page);
    const sheet = await openConnect(page);

    const top = () => expect.poll(async () => (await box(sheet)).y).toBeCloseTo(height * 0.05, 0);
    await top();
    const panel = await box(sheet);
    expect(panel.y + panel.height).toBeLessThanOrEqual(height);

    const address = await box(sheet.getByRole('heading', { name: 'This tracker' }));
    const setup = await box(sheet.getByRole('heading', { name: 'Add the tracker to Claude Code' }));
    expect(setup.x).toBeGreaterThan(address.x + address.width);

    const url = sheet.getByText(RAILWAY, { exact: true });
    expect(await overflowsSideways(url)).toBe(false);
    expect((await box(url)).x + (await box(url)).width).toBeLessThan(setup.x);

    const command = mcpCommand(sheet);
    expect(await lineCount(command)).toBe(1);
    expect(await overflowsSideways(command)).toBe(true);

    await sheet.getByRole('button', { name: 'Copy CLI command' }).scrollIntoViewIfNeeded();
    await expect(sheet.getByRole('button', { name: 'Copy CLI command' })).toBeInViewport();
    await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
    await top();
  });
}

test('desktop: Page Down scrolls the sheet right after it opens', async ({ page }, info) => {
  test.skip(isPhone(info.project.name), 'Desktop layout');
  const sheet = await openConnect(page);
  const body = sheet.locator(':focus');
  await expect(body).toContainText('Add the tracker to Claude Code');
  await page.keyboard.press('PageDown');
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('phone: one column, and commands wrap instead of scrolling sideways', async ({
  page,
}, info) => {
  test.skip(!isPhone(info.project.name), 'Phone layout');
  const sheet = await openConnect(page);
  const address = await box(sheet.getByRole('heading', { name: 'This tracker' }));
  const setup = await box(sheet.getByRole('heading', { name: 'Add the tracker to Claude Code' }));
  expect(setup.x).toBe(address.x);
  expect(setup.y).toBeGreaterThan(address.y);

  const command = mcpCommand(sheet);
  expect(await overflowsSideways(command)).toBe(false);
  expect(await lineCount(command)).toBeGreaterThan(1);
});
