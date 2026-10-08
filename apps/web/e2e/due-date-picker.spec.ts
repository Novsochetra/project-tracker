import type { Locator, Page } from '@playwright/test';
import { formatLongDay, formatShortDay, toYmd } from '@tracker/shared';
import { expect, isPhone, test } from './fixtures';
import { activity, openNewTicketIn, seedProject, settled, ticketRow, toast } from './helpers';

// The names screen readers hear for the days, worked out here rather than taken from the app.
const fullDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const daysFromToday = (days: number) => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
};

const dueRow = (scope: Page | Locator) => scope.getByRole('button', { name: /^Due date/ });
const calendar = (page: Page) => page.getByRole('dialog', { name: 'Choose due date' });

test.describe('due date on desktop', () => {
  test('the ticket picks a date from the calendar by mouse and by keyboard', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Phones keep the native date picker');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Plan the launch' }]);
    await page.goto('/p/MOB/1');
    const row = dueRow(page);
    await expect(row).toHaveAccessibleName('Due date None');
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await row.click();
    const picker = calendar(page);
    await expect(picker).toBeVisible();
    await expect(
      picker.getByRole('button', { name: fullDate(new Date()), exact: true }),
    ).toBeFocused();
    const now = new Date();
    const picked = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    await picker.getByRole('button', { name: 'Next month' }).click();
    await picker.getByRole('button', { name: fullDate(picked), exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(row).toHaveAccessibleName(`Due date ${formatLongDay(toYmd(picked))}`);
    await expect(activity(page)).toContainText(
      `You set the due date to ${formatShortDay(toYmd(picked))}`,
    );

    await expect(row).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(picker.getByRole('button', { name: fullDate(picked), exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    const moved = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate() + 8);
    await expect(picker).toBeHidden();
    await expect(row).toBeFocused();
    await expect(row).toHaveAccessibleName(`Due date ${formatLongDay(toYmd(moved))}`);
    await expect(activity(page)).toContainText(
      `You set the due date to ${formatShortDay(toYmd(moved))}`,
    );

    await page.goto('/p/MOB');
    await expect(ticketRow(page, 'MOB-1')).toContainText(formatShortDay(toYmd(moved)));
  });

  test('New ticket takes a quick pick, and Escape closes only the calendar', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Phones keep the native date picker');
    await page.setViewportSize({ width: 800, height: 600 });
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    await sheet.getByLabel('Ticket title').fill('Ship the calendar');
    const row = dueRow(sheet);
    const picker = calendar(page);

    await row.click();
    await expect(picker).toBeVisible();
    await settled(picker);
    const rowBox = (await row.boundingBox())!;
    const box = (await picker.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.y + box.height).toBeLessThanOrEqual(600 - 8);
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(800 - 8);
    expect(box.y + box.height).toBeLessThanOrEqual(rowBox.y);

    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discard changes' })).toHaveCount(0);
    await expect(row).toBeFocused();

    await row.click();
    await picker.getByRole('button', { name: /^Tomorrow/ }).click();
    const tomorrow = toYmd(daysFromToday(1));
    await expect(row).toHaveAccessibleName(`Due date ${formatLongDay(tomorrow)}`);
    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
    await expect(ticketRow(page, 'MOB-2')).toContainText(formatShortDay(tomorrow));
  });

  test('a double-click on a day, a quick pick or an option stays on its popover', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Phones keep the native date picker');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    await sheet.getByLabel('Ticket title').fill('Ship the calendar');
    const row = dueRow(sheet);
    const picker = calendar(page);
    const discard = page.getByRole('dialog', { name: 'Discard changes?' });
    const day = new Date(new Date().getFullYear(), new Date().getMonth(), 22);

    await row.click();
    await picker.getByRole('button', { name: fullDate(day), exact: true }).dblclick();
    await expect(row).toHaveAccessibleName(`Due date ${formatLongDay(toYmd(day))}`);
    await expect(picker).toBeHidden();
    await expect(discard).toHaveCount(0);
    await expect(row).toBeFocused();

    await row.click();
    await picker.getByRole('button', { name: /^Tomorrow/ }).dblclick();
    await expect(row).toHaveAccessibleName(`Due date ${formatLongDay(toYmd(daysFromToday(1)))}`);

    const priority = sheet.getByRole('button', { name: /^Priority/ });
    await priority.click();
    await page.getByRole('option', { name: 'High' }).dblclick();
    await expect(priority).toHaveAccessibleName('Priority High');
    await expect(priority).toBeFocused();
    await expect(discard).toHaveCount(0);
    await expect(sheet).toBeVisible();
  });
});

test.describe('due date on phones', () => {
  test('the ticket and New ticket keep the native date input', async ({ page, api }, info) => {
    test.skip(!isPhone(info.project.name), 'Desktop uses its own calendar');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Plan the launch' }]);
    await page.goto('/p/MOB/1');
    const input = page.getByLabel('Due date', { exact: true });
    await expect(input).toHaveAttribute('type', 'date');
    await expect(dueRow(page)).toHaveCount(0);
    const due = toYmd(daysFromToday(3));
    await input.fill(due);
    await expect(activity(page)).toContainText(`You set the due date to ${formatShortDay(due)}`);
    await expect(page.getByText(formatLongDay(due), { exact: true })).toBeVisible();
    await expect(calendar(page)).toHaveCount(0);

    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    await expect(sheet.getByLabel('Due date', { exact: true })).toHaveAttribute('type', 'date');
    await expect(dueRow(sheet)).toHaveCount(0);
  });
});
