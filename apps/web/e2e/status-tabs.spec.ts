import type { Locator, Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { expect, isPhone, test } from './fixtures';
import { createTicketInSheet, group, seedProject, ticketRow } from './helpers';

const tabs = (page: Page) => page.getByRole('group', { name: 'Filter tickets' });
const tab = (page: Page, name: string) =>
  tabs(page).getByRole('button', { name: new RegExp(`^${name} \\d`) });

const showBoard = async (page: Page): Promise<void> => {
  await page
    .getByRole('group', { name: 'Show tickets as' })
    .getByRole('button', { name: 'Board' })
    .click();
  await expect(page.locator('[data-board]')).toBeVisible();
};

const regionNames = (page: Page) =>
  page
    .getByRole('region')
    .evaluateAll((regions) => regions.map((region) => region.getAttribute('aria-label')));

async function addStatuses(api: TrackerClient, names: string[]): Promise<void> {
  for (const name of names) await api.createStatus('MOB', { name, category: 'in_progress' });
}

const box = async (locator: Locator) => {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Missing box');
  return found;
};

// Whole pixels: the thumb sits on a sub-pixel position the tab rounds differently.
const near = (a: number, b: number) => Math.abs(a - b) <= 1;

async function thumbSitsUnder(page: Page, name: string): Promise<boolean> {
  const thumb = await box(tabs(page).locator('[data-thumb]'));
  const picked = await box(tab(page, name));
  return near(thumb.x, picked.x) && near(thumb.width, picked.width);
}

// Only the tab row and the board may scroll sideways; the page and every other scroller stay put.
const pageScrollsSideways = (page: Page) =>
  page.evaluate(() => {
    const overflows = (element: Element) => element.scrollWidth > element.clientWidth + 1;
    if (overflows(document.documentElement)) return true;
    return [...document.querySelectorAll('*')].some((element) => {
      const { overflowX } = getComputedStyle(element);
      if (overflowX !== 'auto' && overflowX !== 'scroll') return false;
      if (element.matches('[role="group"][aria-label="Filter tickets"], [data-board]'))
        return false;
      return overflows(element);
    });
  });

test.describe('status tabs', () => {
  test('a status tab shows only its group in the list and its column on the board', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Alpha' },
      { title: 'Beta', status: 'In progress' },
      { title: 'Gamma', status: 'Need review' },
      { title: 'Delta', status: 'Done' },
    ]);
    await page.goto('/p/MOB');
    await tab(page, 'Need review').click();
    await expect(tab(page, 'Need review')).toHaveAttribute('aria-pressed', 'true');
    await expect(group(page, 'Need review')).toBeVisible();
    await expect.poll(() => regionNames(page)).toEqual(['Need review']);
    await expect(ticketRow(page, 'MOB-3')).toBeVisible();

    await showBoard(page);
    await expect.poll(() => regionNames(page)).toEqual(['Need review']);
    await tab(page, 'Reviewed').click();
    await expect.poll(() => regionNames(page)).toEqual(['Reviewed']);
    await expect(group(page, 'Reviewed')).toContainText('No tickets');
    await tab(page, 'All').click();
    await expect
      .poll(() => regionNames(page))
      .toEqual(['To do', 'In progress', 'Need review', 'Reviewed', 'Done']);
  });

  test('creating a ticket the tab hides goes back to All and shows it', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Shipped', status: 'Done' }]);
    await page.goto('/p/MOB');
    await tab(page, 'Done').click();
    await page.getByRole('button', { name: 'New ticket', exact: true }).first().click();
    await createTicketInSheet(page, 'Next idea');
    await expect(tab(page, 'All')).toHaveAttribute('aria-pressed', 'true');
    await expect(ticketRow(page, 'MOB-2')).toBeVisible();
    await expect(ticketRow(page, 'MOB-1')).toBeVisible();
  });

  test('renaming and adding statuses updates the tabs', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Waiting on design' }]);
    await page.goto('/p/MOB');
    await tab(page, 'To do').click();
    await page.getByRole('button', { name: 'Project options' }).first().click();
    await page.getByRole('button', { name: 'Manage statuses' }).click();
    const sheet = page.getByRole('dialog', { name: 'Statuses' });
    await sheet.getByRole('button', { name: /^To do/ }).click();
    await sheet.getByLabel('Status name').fill('Backlog');
    await sheet.getByRole('button', { name: 'Save status' }).click();
    await sheet.getByRole('button', { name: 'Add status' }).click();
    await sheet.getByLabel('Status name').fill('Blocked');
    await sheet.getByRole('button', { name: 'Save status' }).click();
    await expect(sheet.getByText('Blocked', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toBeHidden();

    await expect(tabs(page).getByRole('button')).toHaveText([
      'All 1 ticket',
      'Backlog 1 ticket',
      'In progress 0 tickets',
      'Need review 0 tickets',
      'Reviewed 0 tickets',
      'Done 0 tickets',
      'Blocked 0 tickets',
    ]);
    await expect(tab(page, 'Backlog')).toHaveAttribute('aria-pressed', 'true');
    await expect(group(page, 'Backlog')).toBeVisible();
  });

  test('a status deleted elsewhere while picked falls back to All', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Alpha' }, { title: 'Omega' }]);
    await addStatuses(api, ['Blocked']);
    await page.goto('/p/MOB');
    await tab(page, 'Blocked').click();
    await expect(page.getByText('No tickets match.')).toBeVisible();

    const { statuses } = await api.getProject('MOB');
    const blocked = statuses.find((status) => status.name === 'Blocked');
    await api.deleteStatus(blocked!.id);
    await expect(tab(page, 'Blocked')).toHaveCount(0);
    await expect(tab(page, 'All')).toHaveAttribute('aria-pressed', 'true');
    await expect(ticketRow(page, 'MOB-1')).toBeVisible();
  });

  test('phones: the row scrolls sideways, snaps, and brings the picked tab in', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'Phone layout');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Alpha' }]);
    await addStatuses(api, ['Design', 'Blocked', 'QA']);
    await page.goto('/p/MOB');
    const row = tabs(page);
    await expect(tab(page, 'QA')).toBeAttached();
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await pageScrollsSideways(page)).toBe(false);
    for (const button of await row.getByRole('button').all()) {
      expect((await box(button)).height).toBeGreaterThanOrEqual(44);
    }

    const rowBox = await box(row);
    const cutOff = tab(page, 'Need review');
    expect((await box(cutOff)).x + (await box(cutOff)).width).toBeGreaterThan(
      rowBox.x + rowBox.width,
    );
    await cutOff.tap();
    await expect(cutOff).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => {
        const picked = await box(cutOff);
        return picked.x + picked.width <= rowBox.x + rowBox.width + 0.5 && picked.x >= rowBox.x;
      })
      .toBe(true);
    await expect.poll(() => thumbSitsUnder(page, 'Need review')).toBe(true);

    await row.evaluate((el) => el.scrollTo({ left: 37 }));
    await expect
      .poll(() =>
        row.evaluate((el) => {
          const starts = [...el.querySelectorAll('button')].map((b) => b.offsetLeft - 2);
          const max = el.scrollWidth - el.clientWidth;
          return [...starts, max].some((start) => Math.abs(start - el.scrollLeft) <= 1);
        }),
      )
      .toBe(true);
    expect(await pageScrollsSideways(page)).toBe(false);
  });

  test('desktop: tabs share the row with the search, and many statuses scroll in one line', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Desktop layout');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Alpha' }]);
    await page.goto('/p/MOB');
    await expect(tab(page, 'Done')).toBeVisible();
    const middle = async (locator: Locator) => {
      const found = await box(locator);
      return found.y + found.height / 2;
    };
    const searchMiddle = await middle(page.getByLabel('Search tickets'));
    expect(Math.abs((await middle(tabs(page))) - searchMiddle)).toBeLessThan(3);

    await addStatuses(api, [
      'Waiting on design',
      'Blocked by another team',
      'Ready for QA',
      'Staging',
      'Released to beta',
    ]);
    await page.reload();
    await expect(tab(page, 'Released to beta')).toBeAttached();
    const tops = await tabs(page)
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    expect(await tabs(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await pageScrollsSideways(page)).toBe(false);

    await tabs(page).getByRole('button', { name: /^All/ }).focus();
    await page.keyboard.press('End');
    await expect(tab(page, 'Released to beta')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Released to beta')).toHaveAttribute('aria-pressed', 'true');
    const rowBox = await box(tabs(page));
    await expect
      .poll(async () => {
        const picked = await box(tab(page, 'Released to beta'));
        return picked.x + picked.width <= rowBox.x + rowBox.width + 0.5;
      })
      .toBe(true);
    await expect.poll(() => thumbSitsUnder(page, 'Released to beta')).toBe(true);
  });
});
