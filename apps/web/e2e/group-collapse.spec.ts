import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { group, seedProject } from './helpers';

const many = (count: number, status: string) =>
  Array.from({ length: count }, (_, i) => ({ title: `${status} item ${i + 1}`, status }));

// The nav bar's bottom on a phone, the screen's top on desktop: where the header sticks.
const viewTop = (region: Locator) =>
  region.evaluate((node) => {
    const scroller = node.closest('[data-stack-scroller]')!;
    const navBar = scroller.querySelector('[data-navbar]');
    return (navBar ?? scroller).getBoundingClientRect()[navBar ? 'bottom' : 'top'];
  });

const top = async (locator: Locator) => (await locator.boundingBox())!.y;

// The browser's own scroll anchoring may keep the header where it stuck; without it the app
// scrolls back to 16px below the top. Either way the header is near the top, not far above.
async function expectHeaderNearTop(region: Locator, stickAt: number) {
  const offset = (await top(region)) - stickAt;
  expect(offset).toBeGreaterThanOrEqual(0);
  expect(offset).toBeLessThanOrEqual(120);
}

test('an expanded group collapses from its sticky header and comes back into view (PT-180)', async ({
  page,
  api,
}, testInfo) => {
  // Enough below To do that the screen can scroll it back up to the top once it collapses.
  await seedProject(api, 'Mobile app', 'MOB', [
    ...many(20, 'To do'),
    ...many(6, 'In progress'),
    ...many(6, 'Need review'),
    ...many(6, 'Reviewed'),
  ]);
  await page.goto('/p/MOB');
  const todo = group(page, 'To do');
  const rows = todo.getByRole('button', { name: /^MOB-\d+/ });
  const headerLess = todo.getByRole('button', { name: 'Show less of To do' });
  const footerLess = todo.getByRole('button', { name: 'Show less', exact: true });
  await expect(headerLess).toHaveCount(0);

  await todo.getByRole('button', { name: 'Show 15 more' }).click();
  await expect(rows).toHaveCount(20);
  await footerLess.scrollIntoViewIfNeeded();
  const stickAt = await viewTop(todo);
  await expect(headerLess).toBeInViewport();
  expect(await top(todo)).toBeLessThan(stickAt - 200);
  expect(Math.abs((await top(headerLess.locator('..'))) - stickAt)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('stuck-header.png') });

  await headerLess.click();
  await expect(rows).toHaveCount(5);
  await expectHeaderNearTop(todo, stickAt);
  await page.screenshot({ path: testInfo.outputPath('collapsed.png') });

  await todo.getByRole('button', { name: 'Show 15 more' }).click();
  await footerLess.scrollIntoViewIfNeeded();
  await footerLess.click();
  await expect(rows).toHaveCount(5);
  await expectHeaderNearTop(todo, stickAt);
});
