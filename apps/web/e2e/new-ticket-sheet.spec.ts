import type { Locator } from '@playwright/test';
import { expect, test, usesPhoneLayout } from './fixtures';
import { openNewTicketIn, seedProject, toast } from './helpers';

// 150 characters: five lines at 375px.
const LONG_TITLE =
  'Let Claude group related tickets into one PR when they touch the same screen, and write a short summary of every change in the PR description for revi';

const showsAllText = (field: Locator) =>
  field.evaluate(
    (element) =>
      element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth,
  );

test.describe('new ticket sheet', () => {
  test('a long title wraps and stays in view while typing, and Enter creates it', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const title = page.getByRole('dialog', { name: 'New ticket' }).getByLabel('Ticket title');

    await title.fill(LONG_TITLE);
    expect(await showsAllText(title)).toBe(true);
    await title.press('Enter');
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
  });

  test('text a keyboard inserts line by line stays whole, on one line', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const title = page.getByRole('dialog', { name: 'New ticket' }).getByLabel('Ticket title');

    // Dictation and clipboard keyboards insert this way; WebKit adds the text one line at a time.
    await title.click();
    await page.keyboard.type('Fix the login');
    await page.keyboard.insertText(' on iPad\ncrash after rotate\nsteps inside');
    await expect(title).toHaveValue('Fix the login on iPad crash after rotate steps inside');
  });

  test('a paste turns its line breaks into spaces before the length limit, and undoes', async ({
    page,
    api,
    browserName,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    const title = sheet.getByLabel('Ticket title');
    const description = sheet.getByLabel('Description', { exact: true });
    const copy = async (text: string) => {
      await description.fill(text);
      await description.press('ControlOrMeta+a');
      await description.press('ControlOrMeta+c');
    };

    await title.fill('Fix crash');
    await copy(' the\n\n login \n');
    await title.click();
    await title.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(3, 3));
    await title.press('ControlOrMeta+v');
    await expect(title).toHaveValue('Fix the login crash');
    // WebKit's undo takes back the typing before a paste too, in any text area.
    if (browserName !== 'webkit') {
      await title.press('ControlOrMeta+z');
      await expect(title).toHaveValue('Fix crash');
    }

    await copy(`bc${'\n'.repeat(8)}defgh`);
    await title.fill('a'.repeat(290));
    await title.press('ControlOrMeta+v');
    await expect(title).toHaveValue(`${'a'.repeat(290)}bc defgh`);
  });

  test('typed text comes back after a reload until the ticket is created', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    await sheet.getByLabel('Ticket title').fill('Offline mode for quick capture');
    await sheet.getByLabel('Description', { exact: true }).fill('Keep captures in a queue');

    await page.reload();
    await openNewTicketIn(page, 'To do');
    await expect(sheet.getByLabel('Ticket title')).toHaveValue('Offline mode for quick capture');
    await expect(sheet.getByLabel('Description', { exact: true })).toHaveValue(
      'Keep captures in a queue',
    );
    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();

    await page.reload();
    await openNewTicketIn(page, 'To do');
    await expect(sheet.getByLabel('Ticket title')).toHaveValue('');
  });

  test('desktop: Discard changes takes a click at once, and a double-click or double tap discards nothing @tablet', async ({
    page,
    api,
  }, info) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    test.skip(await usesPhoneLayout(page), 'A mouse on a desktop screen');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    const title = sheet.getByLabel('Ticket title');
    await title.fill('Crash on launch');
    const discard = page.getByRole('dialog', { name: 'Discard changes?' });
    const discardRow = discard.getByRole('button', { name: 'Discard changes' });
    await title.press('Escape');
    await discardRow.click();
    await expect(sheet).toBeHidden();

    // A double-click on the backdrop where Discard changes comes to rest: the first click asks,
    // and the second, a person's 150 ms later, lands on the row sliding up under it.
    await openNewTicketIn(page, 'To do');
    await title.fill('Crash on launch');
    await title.press('Escape');
    await discardRow.click({ trial: true });
    const spot = (await discardRow.boundingBox())!;
    await discard.getByRole('button', { name: 'Keep editing' }).click();
    await expect(discard).toBeHidden();
    const [x, y] = [spot.x + spot.width / 2, spot.y + spot.height / 2];
    if (info.project.use.hasTouch) {
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(150);
      await page.touchscreen.tap(x, y);
    } else {
      await page.mouse.click(x, y);
      await page.waitForTimeout(150);
      await page.mouse.down({ clickCount: 2 });
      await page.mouse.up({ clickCount: 2 });
    }
    await page.waitForTimeout(600);
    await expect(discardRow).toBeVisible();
    await expect(title).toHaveValue('Crash on launch');
  });
});
