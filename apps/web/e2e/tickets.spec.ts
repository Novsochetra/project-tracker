import { toYmd } from '@tracker/shared';
import { expect, test } from './fixtures';
import {
  activity,
  createTicketInSheet,
  group,
  openNewTicketIn,
  pickFromListbox,
  seedProject,
  ticketRow,
  toast,
} from './helpers';

const daysFromNow = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toYmd(date);
};

test.describe('tickets', () => {
  test('creates tickets at the top of the group and never reuses numbers', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');

    await openNewTicketIn(page, 'To do');
    await createTicketInSheet(page, 'Crash when rotating');
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
    const rows = group(page, 'To do').getByRole('button', { name: /^MOB-\d/ });
    await expect(rows.first()).toContainText('MOB-2');

    await ticketRow(page, 'MOB-2').click();
    await expect(page).toHaveURL(/\/p\/MOB\/2$/);
    await page.getByRole('button', { name: 'Delete ticket' }).click();
    await expect(page.getByRole('alert')).toContainText("Delete MOB-2? This can't be undone.");
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/p\/MOB$/);
    await expect(toast(page, 'MOB-2 deleted')).toBeVisible();

    await openNewTicketIn(page, 'To do');
    await createTicketInSheet(page, 'Another one');
    await expect(toast(page, 'MOB-3 created')).toBeVisible();
  });

  test('creating a hidden ticket resets the filter to All', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Shipped', status: 'Done' }]);
    await page.goto('/p/MOB');
    const filters = page.getByRole('group', { name: 'Filter tickets' });
    await filters.getByRole('button', { name: /^Done/ }).click();
    await expect(filters.getByRole('button', { name: /^Done/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'New ticket', exact: true }).first().click();
    await createTicketInSheet(page, 'New idea');
    await expect(filters.getByRole('button', { name: /^All/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(ticketRow(page, 'MOB-2')).toBeVisible();
  });

  test('edits fields and logs the right activity', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Fix login' }]);
    await page.goto('/p/MOB/1');

    await page.getByLabel('Title', { exact: true }).fill('Fix the login error');
    await page.getByLabel('Description', { exact: true }).fill('Show an inline error.');
    await pickFromListbox(page, 'Status', 'In progress');
    await pickFromListbox(page, 'Priority', 'High');
    const assignee = page.getByLabel('Assignee', { exact: true });
    await assignee.fill('Dara');
    await assignee.blur();

    const log = activity(page);
    await expect(log).toContainText('You created the ticket');
    await expect(log).toContainText('You changed status to In progress');
    await expect(log).toContainText('You set priority to High');
    await expect(log).toContainText('You assigned the ticket to Dara');
    await expect(log).not.toContainText('title');

    await page.reload();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Fix the login error');
    await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
      'Show an inline error.',
    );
  });

  test('overdue dates show in red until done, and clearing logs an event', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Late', due: daysFromNow(-2) }]);
    await page.goto('/p/MOB/1');
    const clear = page.getByRole('button', { name: 'Clear due date' });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(activity(page)).toContainText('You removed the due date');
  });

  test('deep links, reload and browser history work', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'One' }, { title: 'Two' }]);
    await page.goto('/p/MOB/2');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Two');
    await page.goto('/p/MOB/99');
    await expect(page).toHaveURL(/\/p\/MOB$/);
    await page.goto('/p/NOPE');
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/');
    await page
      .getByRole('button', { name: /Mobile app/ })
      .last()
      .click();
    await ticketRow(page, 'MOB-1').click();
    await expect(page).toHaveURL(/\/p\/MOB\/1$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/p\/MOB$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/p\/MOB\/1$/);
  });
});
