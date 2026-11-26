import type { Locator, Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { expect, isPhone, test } from './fixtures';

const NAMES = ['Alpha', 'Beta', 'Gamma'];

async function makeProjects(api: TrackerClient): Promise<string[]> {
  const ids = [];
  for (const name of NAMES) ids.push((await api.createProject({ name })).project.id);

  return ids;
}

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Projects' });
const sidebarItem = (page: Page, name: string) =>
  sidebar(page).getByRole('button', { name: new RegExp(`^${name}\\b`) });

const sidebarOrder = (page: Page): Promise<string[]> =>
  sidebar(page)
    .locator('[data-reorder-row]')
    .evaluateAll((rows) => rows.map((row) => row.querySelector('span + span')?.textContent ?? ''));

// The Projects screen's own list (cards on desktop, rows on phones), in the order shown.
const mainOrder = (page: Page): Promise<string[]> =>
  page
    .getByRole('main')
    .getByRole('button', { name: /^(Alpha|Beta|Gamma)\b/ })
    .evaluateAll((buttons) =>
      buttons.map((button) => /Alpha|Beta|Gamma/.exec(button.textContent ?? '')?.[0] ?? ''),
    );

// Counts what changes in the sidebar's list while a drag runs: a drag that re-rendered rows would
// add, remove or retext nodes.
function watchList(page: Page): Promise<void> {
  return page.evaluate(() => {
    const list = document.querySelector('[data-reorder-row]')?.parentElement;
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
    Object.assign(window, { listChanges: seen, stopWatching: () => observer.disconnect() });
  });
}

const listChanges = (page: Page) =>
  page.evaluate(() => {
    const own = window as unknown as { listChanges: { nodes: number; styles: number } };

    return own.listChanges;
  });

async function dragBy(page: Page, source: Locator, rows: number, beforeDrop: () => Promise<void>) {
  const box = await source.boundingBox();
  if (!box) throw new Error('Missing source box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + rows * (box.height + 2), { steps: 12 });
  await beforeDrop();
  await page.mouse.up();
}

test.describe('project order', () => {
  test('dragging a project in the sidebar moves it, only by transforms, and the order stays', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'The sidebar is desktop only');
    await makeProjects(api);
    await page.goto('/');
    await expect.poll(() => sidebarOrder(page)).toEqual(NAMES);

    await watchList(page);
    const saved = page.waitForResponse(
      (response) => response.url().endsWith('/api/projects/order') && response.status() === 200,
    );
    await dragBy(page, sidebarItem(page, 'Alpha'), 2, async () => {
      await expect(sidebarItem(page, 'Alpha')).toHaveAttribute('data-dragging', '');
      await expect(sidebarItem(page, 'Beta')).toHaveCSS(
        'transform',
        /matrix\(1, 0, 0, 1, 0, -34\)/,
      );
      await page.screenshot({ path: info.outputPath('sidebar-drag.png') });
      const during = await listChanges(page);
      expect(during.nodes).toBe(0);
      expect(during.styles).toBeGreaterThan(0);
    });
    await saved;
    await expect.poll(() => sidebarOrder(page)).toEqual(['Beta', 'Gamma', 'Alpha']);
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => mainOrder(page)).toEqual(['Beta', 'Gamma', 'Alpha']);

    await page.reload();
    await expect.poll(() => sidebarOrder(page)).toEqual(['Beta', 'Gamma', 'Alpha']);
    await page.screenshot({ path: info.outputPath('sidebar-after.png') });
  });

  test('Alt and an arrow key move the focused project, and a click still opens one', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'The sidebar is desktop only');
    await makeProjects(api);
    await page.goto('/');
    await sidebarItem(page, 'Gamma').focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(() => sidebarOrder(page)).toEqual(['Alpha', 'Gamma', 'Beta']);
    await expect(sidebarItem(page, 'Gamma')).toBeFocused();
    await expect
      .poll(async () => (await api.listProjects()).map((project) => project.name))
      .toEqual(['Alpha', 'Gamma', 'Beta']);

    await sidebarItem(page, 'Beta').click();
    await expect(page).toHaveURL(/\/p\/BET$/);
  });

  test('the Projects list shows the saved order on every layout', async ({ page, api }) => {
    const [alpha, beta, gamma] = await makeProjects(api);
    await api.reorderProjects([gamma ?? '', alpha ?? '', beta ?? '']);
    await page.goto('/');
    await expect.poll(() => mainOrder(page)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });
});
