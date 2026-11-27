import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { activity, group, seedProject, ticketRow, toast } from './helpers';

const keysIn = (section: Locator): Promise<string[]> =>
  section
    .locator('[data-drop-row]')
    .evaluateAll((rows) => rows.map((row) => /[A-Z]+-\d+/.exec(row.textContent ?? '')?.[0] ?? ''));

const shiftOf = (page: Page, key: string): Promise<number> =>
  page
    .locator('[data-drop-row]', { has: ticketRow(page, key) })
    .evaluate((row) => new DOMMatrixReadOnly(getComputedStyle(row).transform).m42);

// Playwright can't drive a touch drag in WebKit, so the finger is synthetic touch pointer events
// on the handle, which bubble to the drag's window listeners.
async function fingerOnHandle(page: Page, key: string) {
  const handle = page.getByRole('button', { name: `Move ${key}. Drag, or use the arrow keys.` });
  const box = await handle.boundingBox();
  if (!box) throw new Error('The handle is not on screen.');
  const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
  const at = (y: number) => ({ ...base, clientX: box.x + box.width / 2, clientY: y });
  await handle.dispatchEvent('pointerdown', at(box.y + box.height / 2));

  return {
    moveTo: async (y: number) => {
      for (let step = 0; step < 6; step += 1) await handle.dispatchEvent('pointermove', at(y));
    },
    lift: (y: number) => handle.dispatchEvent('pointerup', at(y)),
  };
}

async function dragTo(page: Page, source: Locator, target: Locator): Promise<void> {
  const from = await source.boundingBox();
  if (!from) throw new Error('Missing source box');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 3 });
  // Empty groups open drop zones once the drag starts, which moves the target down.
  await page.waitForTimeout(250);
  const to = await target.boundingBox();
  if (!to) throw new Error('Missing target box');
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

  test('the rows slide aside while a row is dragged, and it drops into the gap', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Mouse drag is desktop only');
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'One' },
      { title: 'Two' },
      { title: 'Three' },
    ]);
    await page.goto('/p/MOB');
    const todo = group(page, 'To do');
    await expect(todo.locator('[data-drop-row]')).toHaveCount(3);
    const [first, second, third] = await keysIn(todo);
    if (!first || !second || !third) throw new Error('Missing rows');

    const from = await ticketRow(page, first).boundingBox();
    const past = await ticketRow(page, second).boundingBox();
    if (!from || !past) throw new Error('Missing row boxes');
    const x = from.x + from.width / 2;
    await page.mouse.move(x, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, from.y + from.height / 2 + 12, { steps: 3 });
    await page.mouse.move(x, past.y + past.height - 4, { steps: 8 });
    // The row it passed slid up into its place, and the one below stayed.
    await expect.poll(() => shiftOf(page, second)).toBeCloseTo(-from.height, 0);
    expect(await shiftOf(page, third)).toBe(0);

    await page.mouse.up();
    await expect.poll(() => keysIn(todo)).toEqual([second, first, third]);
    await expect.poll(() => shiftOf(page, second)).toBe(0);
  });

  test('a finger on the handle opens a gap in the group it enters', async ({ page, api }, info) => {
    test.skip(!isPhone(info.project.name), 'Touch drag is the phone list');
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Moving', status: 'To do' },
      { title: 'Staying', status: 'In progress' },
      // To do keeps a row, so it stays shown after the drop and In progress doesn't move up.
      { title: 'Left behind', status: 'To do' },
    ]);
    await page.goto('/p/MOB');
    const progress = group(page, 'In progress');
    const staying = await ticketRow(page, 'MOB-2').boundingBox();
    if (!staying) throw new Error('Missing row box');

    const finger = await fingerOnHandle(page, 'MOB-1');
    // To do folds away above In progress as the finger arrives, so aim at its upper part.
    await finger.moveTo(staying.y - 20);
    await expect.poll(() => shiftOf(page, 'MOB-2')).toBeGreaterThan(40);
    await expect(progress.locator('[data-group-end]')).not.toHaveCSS('padding-top', '0px');

    const shown = await ticketRow(page, 'MOB-2').boundingBox();
    await finger.lift(staying.y - 20);
    await expect.poll(() => keysIn(progress)).toEqual(['MOB-1', 'MOB-2']);
    await expect(toast(page, 'MOB-1 moved to In progress')).toBeVisible();
    await expect
      .poll(async () => (await ticketRow(page, 'MOB-2').boundingBox())?.y)
      .toBeCloseTo(shown?.y ?? 0, 0);
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
