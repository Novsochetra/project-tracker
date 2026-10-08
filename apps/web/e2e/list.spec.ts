import { expect, test } from './fixtures';
import { group, seedProject, ticketRow } from './helpers';

const many = (count: number, status: string) =>
  Array.from({ length: count }, (_, i) => ({ title: `${status} item ${i + 1}`, status }));

test.describe('ticket list', () => {
  test('tab counts cover the whole project and search finds keys', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Alpha' },
      { title: 'Beta', status: 'In progress' },
      { title: 'Gamma', status: 'Done' },
    ]);
    await page.goto('/p/MOB');
    const filters = page.getByRole('group', { name: 'Filter tickets' });
    await expect(filters.getByRole('button')).toHaveText([
      'All 3 tickets',
      'To do 1 ticket',
      'In progress 1 ticket',
      'Need review 0 tickets',
      'Reviewed 0 tickets',
      'Done 1 ticket',
    ]);

    await page.getByLabel('Search tickets').fill('mob-3');
    await expect(ticketRow(page, 'MOB-3')).toBeVisible();
    await expect(ticketRow(page, 'MOB-1')).toBeHidden();
    await expect(filters.getByRole('button', { name: 'All 3 tickets' })).toBeVisible();

    await page.getByLabel('Search tickets').fill('zzz');
    await expect(page.getByText('No tickets match.')).toBeVisible();
  });

  test("a status tab shows only that status's group", async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Alpha' },
      { title: 'Gamma', status: 'Done' },
    ]);
    await page.goto('/p/MOB');
    const filters = page.getByRole('group', { name: 'Filter tickets' });
    await filters.getByRole('button', { name: /^To do/ }).click();
    await expect(group(page, 'Done')).toBeHidden();
    await expect(group(page, 'To do')).toBeVisible();
    await filters.getByRole('button', { name: /^Done/ }).click();
    await expect(group(page, 'To do')).toBeHidden();
    await expect(group(page, 'Done')).toBeVisible();
    await filters.getByRole('button', { name: /^All/ }).click();
    await expect(group(page, 'To do')).toBeVisible();
    await expect(group(page, 'Done')).toBeVisible();
  });

  test('long groups collapse to five rows', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [...many(7, 'To do'), ...many(6, 'In progress')]);
    await page.goto('/p/MOB');
    const todo = group(page, 'To do');
    await expect(todo.getByRole('button', { name: /^MOB-\d+/ })).toHaveCount(5);
    const more = todo.getByRole('button', { name: 'Show 2 more' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(todo.getByRole('button', { name: /^MOB-\d+/ })).toHaveCount(7);
    await expect(todo.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const doing = group(page, 'In progress');
    await expect(doing.getByRole('button', { name: /^MOB-\d+/ })).toHaveCount(6);
    await expect(doing.getByRole('button', { name: /Show \d+ more/ })).toHaveCount(0);

    await page.getByLabel('Search tickets').fill('item');
    await expect(todo.getByRole('button', { name: /^MOB-\d+/ })).toHaveCount(7);
    await expect(todo.getByRole('button', { name: /Show/ })).toHaveCount(0);
  });

  test('groups follow the status order', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'A', status: 'Done' },
      { title: 'B', status: 'Need review' },
      { title: 'C', status: 'To do' },
    ]);
    await page.goto('/p/MOB');
    await expect(group(page, 'Done')).toBeVisible();
    const names = await page
      .getByRole('region')
      .evaluateAll((sections) => sections.map((s) => s.getAttribute('aria-label')));
    expect(names.filter((n) => ['To do', 'Need review', 'Done'].includes(n ?? ''))).toEqual([
      'To do',
      'Need review',
      'Done',
    ]);
  });
});
