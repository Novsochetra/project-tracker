import type { Locator, Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { byRank } from '@tracker/shared';
import { expect, isPhone, isTablet, test } from './fixtures';
import { group, readActionSheet, readMenuConfirm, seedProject, settled, toast } from './helpers';

const readySection = (page: Page) => page.getByRole('region', { name: 'Ready for you' });

const shownKeys = (within: Locator) =>
  within
    .getByRole('button', { name: /^[A-Z]+-\d+\b/ })
    .evaluateAll((buttons) =>
      buttons.map((button) => /^[A-Z]+-\d+/.exec(button.textContent ?? '')?.[0]),
    );

async function places(api: TrackerClient, projectKey: string): Promise<string[]> {
  const board = await api.getBoard(projectKey);

  return board.statuses.flatMap((status) =>
    board.tickets
      .filter((ticket) => ticket.statusId === status.id)
      .sort(byRank)
      .map((ticket) => `${status.name} ${ticket.key} ${ticket.rank}`),
  );
}

// The second tap: the action sheet's row on a phone, the menu's button on a desktop.
async function confirmMoveAll(page: Page, phone: boolean, label: string): Promise<void> {
  if (phone) {
    const sheet = page.getByRole('dialog', { name: 'Move to Done' });
    await readActionSheet(page);
    await sheet.getByRole('button', { name: label }).click();
    return;
  }

  const menu = page.getByRole('group', { name: 'Move to Done' });
  await readMenuConfirm(page);
  await menu.getByRole('button', { name: 'Move to Done' }).click();
}

const seedReviewed = async (api: TrackerClient) => {
  const reviewed = (title: string) => ({ title, status: 'Reviewed' });
  await seedProject(api, 'Mobile app', 'MOB', [
    reviewed('Cache avatars'),
    reviewed('Dark mode colors'),
    reviewed('Crash on rotate'),
    { title: 'Still to do' },
  ]);
  await seedProject(api, 'Website', 'WEB', [reviewed('Hero copy'), reviewed('Footer links')]);
};

test.describe('move all to Done', () => {
  test('two taps clear Ready for you, then Undo brings every ticket back', async ({
    page,
    api,
    agent,
  }, info) => {
    const phone = isPhone(info.project.name);
    await seedReviewed(api);
    const before = { mobile: await places(api, 'MOB'), website: await places(api, 'WEB') };
    await page.goto('/');
    const section = readySection(page);
    await expect.poll(() => shownKeys(section)).toHaveLength(5);
    const shown = await shownKeys(section);

    await section.getByRole('button', { name: 'Move 5 to Done' }).click();
    await confirmMoveAll(page, phone, 'Move 5 to Done');

    await expect(toast(page, '5 tickets moved to Done')).toBeVisible();
    await expect(section).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();

    await expect(toast(page, '5 tickets moved back')).toBeVisible();
    await expect.poll(() => shownKeys(readySection(page))).toEqual(shown);
    const after = async () => ({
      mobile: await places(api, 'MOB'),
      website: await places(api, 'WEB'),
    });
    await expect.poll(after).toEqual(before);
    const detail = await api.getTicket('WEB-2');
    expect(detail.activity.slice(-2)).toMatchObject([
      { text: 'changed status to Done', actor: { kind: 'human' } },
      { text: 'changed status to Reviewed', actor: { kind: 'human' } },
    ]);
    await expect(agent.moveToDone(['MOB-1'])).rejects.toMatchObject({ status: 403 });
  });

  test("a project's Reviewed group goes to the top of Done in its order, and back", async ({
    page,
    api,
  }, info) => {
    const phone = isPhone(info.project.name);
    await seedReviewed(api);
    const before = await places(api, 'MOB');
    await page.goto('/p/MOB');
    const reviewed = group(page, 'Reviewed');
    await expect.poll(() => shownKeys(reviewed)).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);

    await reviewed.getByRole('button', { name: 'Move 3 to Done' }).click();
    await confirmMoveAll(page, phone, 'Move 3 to Done');

    await expect(toast(page, '3 tickets moved to Done')).toBeVisible();
    await expect.poll(() => shownKeys(group(page, 'Done'))).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
    await expect(reviewed).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();

    await expect
      .poll(() => shownKeys(group(page, 'Reviewed')))
      .toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
    await expect.poll(() => places(api, 'MOB')).toEqual(before);
  });
});

const showBoard = async (page: Page): Promise<void> => {
  await page
    .getByRole('group', { name: 'Show tickets as' })
    .getByRole('button', { name: 'Board' })
    .click();
  await expect(group(page, 'Need review')).toBeVisible();
};

const top = async (locator: Locator) => (await locator.boundingBox())!.y;

// PT-277: a 260px column header has no room for the words, so it holds the double check alone,
// the size of the + beside it, and the columns' first cards stay in line.
test("the board's Reviewed column moves to Done from its header, and back @tablet", async ({
  page,
  api,
}, info) => {
  const phone = isPhone(info.project.name);
  const press = (target: Locator) => (isTablet(info.project.name) ? target.tap() : target.click());
  await seedReviewed(api);
  const before = await places(api, 'MOB');
  await page.goto('/p/MOB');
  await showBoard(page);
  const reviewed = group(page, 'Reviewed');
  await expect.poll(() => shownKeys(reviewed)).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);

  const moveAll = reviewed.getByRole('button', { name: 'Move 3 to Done' });
  const add = (name: string) =>
    group(page, name).getByRole('button', { name: `New ticket in ${name}` });
  await expect(moveAll).toHaveText('');
  await moveAll.scrollIntoViewIfNeeded();
  await settled(page.locator('[data-board]'));
  expect((await moveAll.boundingBox())!.height).toBe((await add('Reviewed').boundingBox())!.height);
  expect(await top(add('Reviewed').locator('..'))).toBe(await top(add('To do').locator('..')));
  const firstCard = (name: string) => group(page, name).locator('[data-drop-row]').first();
  if (!phone) expect(await top(firstCard('Reviewed'))).toBe(await top(firstCard('To do')));

  await press(moveAll);
  if (phone) {
    const sheet = page.getByRole('dialog', { name: 'Move to Done' });
    await readActionSheet(page);
    await press(sheet.getByRole('button', { name: 'Move 3 to Done' }));
  } else {
    const menu = page.getByRole('group', { name: 'Move to Done' });
    await expect(menu).toContainText('Move all 3 tickets to Done?');
    await readMenuConfirm(page);
    await press(menu.getByRole('button', { name: 'Move to Done' }));
  }

  await expect(toast(page, '3 tickets moved to Done')).toBeVisible();
  await expect.poll(() => shownKeys(group(page, 'Done'))).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
  await expect(reviewed).toContainText('No tickets');
  await expect(moveAll).toHaveCount(0);
  // The confirm holds a double tap's second tap for 500 ms (holdPresses), Undo's too.
  await page.waitForTimeout(500);
  await press(page.getByRole('button', { name: 'Undo' }));

  await expect(toast(page, '3 tickets moved back')).toBeVisible();
  await expect.poll(() => shownKeys(reviewed)).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
  await expect.poll(() => places(api, 'MOB')).toEqual(before);
});

const middle = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;

  return box.y + box.height / 2;
};

// PT-273 review: at phone width the button took the header's room, so the + fell to a second line
// and the stuck header grew past the 45px rows scroll clear of (WCAG 2.4.11).
test('group headers stay one line at phone width, and focus stays clear of the stuck one', async ({
  page,
  api,
}, info) => {
  test.skip(isPhone(info.project.name), 'Tab moves through buttons in Chromium; WebKit skips them');
  const qaName = 'Reviewed and waiting for QA';
  const reviewed = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      title: `Approved ${index + 1}`,
      status: 'Reviewed',
    }));
  await seedProject(api, 'Mobile app', 'MOB', reviewed(30));
  const qa = await api.createStatus('MOB', { name: qaName, category: 'reviewed' });
  for (const title of ['QA one', 'QA two'])
    await api.createTicket('MOB', { title, statusId: qa.id });

  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/p/MOB');
    for (const name of ['Reviewed', qaName]) {
      const add = group(page, name).getByRole('button', { name: `New ticket in ${name}` });
      const header = add.locator('..');
      expect((await header.boundingBox())!.height).toBeLessThanOrEqual(45.5);
      expect(
        Math.abs((await middle(add)) - (await middle(header.getByText(name, { exact: true })))),
      ).toBeLessThan(2);
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  const many = group(page, 'Reviewed');
  await many.getByRole('button', { name: 'Show 25 more' }).click();
  const headerLess = many.getByRole('button', { name: 'Show less of Reviewed' });
  const header = headerLess.locator('..');
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(45.5);
  await many.getByRole('button', { name: 'Show less', exact: true }).focus();
  // Up past the first rows on screen, so the browser scrolls each one into view below the header.
  for (let press = 0; press < 30; press++) {
    await page.keyboard.press('Shift+Tab');
    const box = (await header.boundingBox())!;
    const focusedTop = await page.evaluate(
      () => document.activeElement!.getBoundingClientRect().top,
    );
    expect(focusedTop).toBeGreaterThanOrEqual(box.y + box.height - 0.5);
  }
});
