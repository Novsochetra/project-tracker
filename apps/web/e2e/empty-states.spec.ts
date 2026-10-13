import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, isPhone, test, usesPhoneLayout } from './fixtures';
import { seedProject, settled, settledScreenshot } from './helpers';

// PT-215 and PT-216: an empty project and an empty chat list sat near the top (the chats in a
// card stuck to the left on desktop) with a button that repeated the header's (the nav bar's or
// the bottom bar's on phones). They now sit in the middle of the free area, between the bars,
// with no button of their own.

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = (await locator.boundingBox())!;
  return { top: box.y, bottom: box.y + box.height, left: box.x, right: box.x + box.width };
}

const layer = (page: Page, path: string) => page.locator(`[data-stack-path="${path}"]`);

// The tile to the last line of text, without the padding around them.
async function emptyContent(page: Page, title: string): Promise<Box> {
  const empty = page.getByText(title, { exact: true }).locator('..');
  await expect(empty.getByRole('button')).toHaveCount(0);
  await settled(empty);
  const tile = await boxOf(empty.locator(':scope > :first-child'));
  const text = await boxOf(empty.locator(':scope > :last-child'));
  return { top: tile.top, bottom: text.bottom, left: tile.left, right: tile.right };
}

async function freeBottom(page: Page, path: string): Promise<number> {
  if (await usesPhoneLayout(page)) {
    return (await boxOf(layer(page, path).locator('[data-bottom-bar]'))).top;
  }
  return (await boxOf(layer(page, path))).bottom;
}

async function freeArea(page: Page, path: string, above?: Locator): Promise<Box> {
  const screen = await boxOf(layer(page, path));
  const top = above ? (await boxOf(above)).bottom : screen.top;
  return { top, bottom: await freeBottom(page, path), left: screen.left, right: screen.right };
}

// The pages keep room for the phone's bottom bar (and on desktop for the end of a long list), so
// the middle sits up to 48px above the free area's.
function expectCentred(content: Box, free: Box): void {
  expect(content.top).toBeGreaterThanOrEqual(free.top + 8);
  expect(content.bottom).toBeLessThanOrEqual(free.bottom - 8);
  const middle = (box: Box) => (box.top + box.bottom) / 2;
  expect(Math.abs(middle(content) - middle(free))).toBeLessThanOrEqual(52);
  const centre = (box: Box) => (box.left + box.right) / 2;
  expect(Math.abs(centre(content) - centre(free))).toBeLessThanOrEqual(2);
}

function expectBetweenBars(content: Box, free: Box): void {
  expect(content.top).toBeGreaterThanOrEqual(free.top);
  expect(content.bottom).toBeLessThanOrEqual(free.bottom);
}

async function expectNoScroll(page: Page, path: string): Promise<void> {
  const scroller = layer(page, path).locator('[data-stack-scroller]');
  const overflow = await scroller.evaluate((node) => node.scrollHeight - node.clientHeight);
  expect(overflow).toBeLessThanOrEqual(0);
}

const filterRow = (page: Page) => page.getByLabel('Search tickets');

async function openEmptyProject(page: Page): Promise<Box> {
  await page.goto('/p/WEB');
  const content = await emptyContent(page, 'No tickets yet');
  await expect(page.getByText('Create the first ticket for Website.')).toBeVisible();
  // The header's (desktop) or the nav bar's (phone) New ticket is the one way to act.
  await expect(page.getByRole('button', { name: 'New ticket', exact: true })).toHaveCount(1);
  return content;
}

async function openEmptyChats(page: Page): Promise<Box> {
  await page.goto('/p/WEB/ask');
  const content = await emptyContent(page, 'No chats yet');
  await expect(page.getByRole('button', { name: 'New chat', exact: true })).toHaveCount(1);
  return content;
}

async function chatsFreeArea(page: Page): Promise<Box> {
  const path = '/p/WEB/ask';
  const phone = await usesPhoneLayout(page);
  return freeArea(page, path, phone ? layer(page, path).locator('[data-navbar]') : undefined);
}

const shot = (page: Page, info: TestInfo, name: string) =>
  settledScreenshot(page, info.outputPath(`${name}-${info.project.name}.png`));

test.beforeEach(async ({ api }) => {
  await seedProject(api, 'Website', 'WEB');
});

test('an empty project sits in the middle under the filters, with no New ticket of its own', async ({
  page,
}, info) => {
  const content = await openEmptyProject(page);
  expectCentred(content, await freeArea(page, '/p/WEB', filterRow(page)));
  await expectNoScroll(page, '/p/WEB');
  await shot(page, info, 'empty-project');
});

test('an empty chat list sits in the middle, with no New chat of its own', async ({
  page,
}, info) => {
  const content = await openEmptyChats(page);
  expectCentred(content, await chatsFreeArea(page));
  await expectNoScroll(page, '/p/WEB/ask');
  await shot(page, info, 'empty-chats');
});

test('an empty status tab and a search with no match still read under the filters', async ({
  page,
  api,
}, info) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Alpha' }]);
  await page.goto('/p/MOB');
  const filters = page.getByRole('toolbar', { name: 'Filter tickets' });
  await filters.getByRole('button', { name: /^Done/ }).click();
  const noneInDone = page.getByText('No tickets in Done');
  await expect(noneInDone).toBeVisible();
  const below = async (target: Locator) =>
    (await boxOf(target)).top - (await boxOf(page.getByLabel('Search tickets'))).bottom;
  expect(await below(noneInDone)).toBeLessThanOrEqual(64);
  await expectNoScroll(page, '/p/MOB');
  await shot(page, info, 'empty-status-tab');

  await filters.getByRole('button', { name: /^All/ }).click();
  await page.getByLabel('Search tickets').fill('zzz');
  const noMatch = page.getByText('No tickets match.');
  await expect(noMatch).toBeVisible();
  expect(await below(noMatch)).toBeLessThanOrEqual(64);
});

for (const size of [
  { name: '320', viewport: { width: 320, height: 568 }, screen: { width: 320, height: 568 } },
  { name: 'sideways', viewport: { width: 874, height: 296 }, screen: { width: 402, height: 874 } },
]) {
  test.describe(`a phone at ${size.name}`, () => {
    test.use({ viewport: size.viewport, contextOptions: { screen: size.screen } });

    test('keeps both empty states between the nav bar and the bottom bar', async ({
      page,
    }, info) => {
      test.skip(!isPhone(info.project.name), 'A phone');
      const project = await openEmptyProject(page);
      expectBetweenBars(project, await freeArea(page, '/p/WEB', filterRow(page)));
      await shot(page, info, `empty-project-${size.name}`);

      const chats = await openEmptyChats(page);
      expectBetweenBars(chats, await chatsFreeArea(page));
      await shot(page, info, `empty-chats-${size.name}`);
    });
  });
}
