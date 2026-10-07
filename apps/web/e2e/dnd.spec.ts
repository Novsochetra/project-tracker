import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { activity, group, seedProject, ticketRow, toast } from './helpers';

async function dragTo(page: Page, source: Locator, target: Locator): Promise<void> {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('Missing bounding box');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 12 });
  await page.mouse.up();
}

test.describe('drag and drop', () => {
  test('dragging a row into another group changes its status', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Mouse drag is desktop only');
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Ready to ship' },
      { title: 'Already done', status: 'Done' },
    ]);
    await page.goto('/p/MOB');
    await dragTo(page, ticketRow(page, 'MOB-1'), group(page, 'Done'));
    await expect(group(page, 'Done')).toContainText('Ready to ship');
    await expect(toast(page, 'MOB-1 moved to Done')).toBeVisible();
    await ticketRow(page, 'MOB-1').click();
    await expect(activity(page)).toContainText('You changed status to Done');
  });

  test('a click without moving opens the ticket', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Just open me' }]);
    await page.goto('/p/MOB');
    await ticketRow(page, 'MOB-1').click();
    await expect(page).toHaveURL(/\/p\/MOB\/1$/);
  });

  test('arrow keys on the handle move a ticket across groups', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Keyboard moves are tested on desktop');
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'First', status: 'To do' },
      { title: 'Second', status: 'In progress' },
    ]);
    await page.goto('/p/MOB');
    const handle = page.getByRole('button', { name: 'Move MOB-1. Drag, or use the arrow keys.' });
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    await expect(group(page, 'In progress')).toContainText('First');
    await expect(toast(page, 'MOB-1 moved to In progress')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Move MOB-1. Drag, or use the arrow keys.' }),
    ).toBeFocused();
  });
});
