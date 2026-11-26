import type { Locator, Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { byRank } from '@tracker/shared';
import { expect, isPhone, test } from './fixtures';
import { group, readActionSheet, readMenuConfirm, seedProject, toast } from './helpers';

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
