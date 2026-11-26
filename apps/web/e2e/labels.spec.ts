import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import {
  agentInstructions,
  readActionSheet,
  seedProject,
  settled,
  settledScreenshot,
  swipeLeft,
  ticketRow,
} from './helpers';

const SHOTS = process.env.E2E_SHOTS_DIR;
const TEMPLATE = '## Steps to reproduce\n1. ';
const NEXT_YEAR = new Date().getFullYear() + 1;
// The widest date a phone row shows, in another year, so the dots have the least room.
const DUE = `${NEXT_YEAR}-05-20`;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await settledScreenshot(page, `${SHOTS}/${test.info().project.name}-${name}.png`);
}

async function height(locator: Locator): Promise<number> {
  await settled(locator);

  return (await locator.boundingBox())!.height;
}

async function makeBugLabel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Manage labels' }).click();
  const sheet = page.getByRole('dialog', { name: 'Labels' });
  await sheet.getByRole('button', { name: 'Add label' }).click();
  await sheet.getByLabel('Label name').fill('Bug');
  // A swatch's dot covers its radio, as a tap lands on the dot.
  const red = sheet.getByRole('radio', { name: 'Red' });
  await red.locator('..').click();
  await expect(red).toBeChecked();
  await sheet.getByRole('textbox', { name: 'Template' }).fill(TEMPLATE);
  await sheet
    .getByRole('textbox', { name: 'Instructions for Claude' })
    .fill('Write a failing regression test first.');
  await shot(page, 'labels-sheet');
  await sheet.getByRole('button', { name: 'Save label' }).click();
  await expect(sheet.getByRole('button', { name: /^Bug/ })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
}

async function labelTicket(page: Page, key: string, phone: boolean): Promise<void> {
  await ticketRow(page, key).click();
  const trigger = page.getByRole('button', { name: phone ? 'Labels No labels' : /^Labels None/ });
  await trigger.click();
  await page.getByRole('listbox', { name: 'Labels' }).getByRole('option', { name: 'Bug' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Labels Bug/ })).toBeVisible();
  await shot(page, 'ticket');
  await page.goBack();
}

test.describe('labels', () => {
  test('a Bug label is made, applied, shown, filtered by, fills New ticket and reaches Claude', async ({
    page,
    api,
  }, info) => {
    const phone = isPhone(info.project.name);
    const seed = { priority: 'high' as const, assignee: 'Dara', due: DUE };
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Crash on rotate', ...seed },
      { title: 'Dark mode', ...seed },
    ]);
    await page.goto('/p/MOB');
    await expect(ticketRow(page, 'MOB-1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter by label' })).toHaveCount(0);

    await makeBugLabel(page);
    await labelTicket(page, 'MOB-1', phone);

    const labelled = ticketRow(page, 'MOB-1');
    await expect(labelled).toHaveAccessibleName(/Bug/);
    for (const width of phone ? [375, 320] : [1280]) {
      await page.setViewportSize({ width, height: phone ? 812 : 800 });
      expect(await height(labelled)).toBeCloseTo(await height(ticketRow(page, 'MOB-2')), 1);
      expect(await labelled.evaluate((row) => row.scrollWidth <= row.clientWidth)).toBe(true);
      await shot(page, `list-${width}`);
    }

    await page.getByRole('button', { name: 'Filter by label' }).click();
    await page.getByRole('listbox', { name: 'Label' }).getByRole('option', { name: 'Bug' }).click();
    await expect(ticketRow(page, 'MOB-2')).toBeHidden();
    await expect(labelled).toBeVisible();
    await shot(page, 'filtered');

    await page.getByRole('button', { name: 'New ticket in To do' }).click();
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    await sheet.getByRole('button', { name: /^Labels/ }).click();
    await page
      .getByRole('listbox', { name: 'Labels' })
      .getByRole('option', { name: 'Bug' })
      .click();
    await page.keyboard.press('Escape');
    await expect(sheet.getByLabel('Description')).toHaveValue(TEMPLATE);
    await sheet.getByLabel('Ticket title').fill('Login fails');
    await shot(page, 'new-ticket');
    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(sheet).toBeHidden();
    await expect(ticketRow(page, 'MOB-3')).toBeVisible();

    expect(await agentInstructions(api, 'MOB-3')).toContain(
      '## Instructions for "Bug" tickets\nWrite a failing regression test first.',
    );
    expect((await api.getTicket('MOB-3')).ticket.description).toContain('## Steps to reproduce');
  });

  test('a release label is made where a ticket is tagged, shows on its row and filters the list', async ({
    page,
    api,
  }, info) => {
    const phone = isPhone(info.project.name);
    const seed = { priority: 'high' as const, assignee: 'Dara', due: DUE };
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Crash on rotate', ...seed },
      { title: 'Dark mode', ...seed },
    ]);
    await page.goto('/p/MOB');
    const tagged = ticketRow(page, 'MOB-1');
    await expect(tagged).toBeVisible();

    if (phone) {
      // A swipe tags a ticket from the list, without opening it.
      await swipeLeft(tagged);
      // WebKit's hit test still finds the row while the actions spring open.
      await page.getByRole('button', { name: 'Labels', exact: true }).dispatchEvent('click');
    } else {
      await tagged.click();
      await page.getByRole('button', { name: /^Labels None/ }).click();
    }

    const picker = page.getByRole('dialog', { name: 'Pick labels' });
    await expect(picker).toBeVisible();
    await expect(picker).toContainText('No labels yet');
    await picker.getByRole('searchbox', { name: 'Find or create a label' }).fill('v1.4');
    if (phone) await picker.getByRole('button', { name: 'Create “v1.4”' }).click();
    else await page.keyboard.press('Enter');
    const release = picker.getByRole('option', { name: 'v1.4' });
    await expect(release).toHaveAttribute('aria-selected', 'true');
    await shot(page, 'release-picker');
    if (phone) {
      await picker.getByRole('button', { name: 'Done' }).click();
    } else {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: /^Labels v1\.4/ })).toBeVisible();
      await page.goBack();
    }

    await expect(picker).toBeHidden();

    await expect(tagged).toHaveAccessibleName(/v1\.4/);
    await expect(tagged.getByText('v1.4', { exact: true }).filter({ visible: true })).toHaveCount(
      1,
    );
    for (const width of phone ? [375, 320] : [1280]) {
      await page.setViewportSize({ width, height: phone ? 812 : 800 });
      await shot(page, `release-list-${width}`);
      expect(await height(tagged)).toBeCloseTo(await height(ticketRow(page, 'MOB-2')), 1);
      expect(await tagged.evaluate((row) => row.scrollWidth <= row.clientWidth)).toBe(true);
      // The release reads in the row: at least "v1.…", also beside a date with a year at 320.
      const name = tagged.getByText('v1.4', { exact: true }).filter({ visible: true });
      const shown = await name.evaluate((element) => ({
        whole: element.scrollWidth <= element.clientWidth,
        width: element.getBoundingClientRect().width,
      }));
      expect(shown.whole || shown.width >= 23.5).toBe(true);
      expect(shown.width).toBeGreaterThan(0);
    }

    await page.getByRole('button', { name: 'Filter by label' }).click();
    await page
      .getByRole('listbox', { name: 'Label' })
      .getByRole('option', { name: 'v1.4' })
      .click();
    await expect(ticketRow(page, 'MOB-2')).toBeHidden();
    await expect(tagged).toBeVisible();
    await shot(page, 'release-filtered');
  });

  test('three swipe actions open past their width, and only a longer drag picks Status', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'Rows swipe on phones');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on rotate' }]);
    await page.goto('/p/MOB');
    const status = page.getByRole('dialog', { name: 'Status' });
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      const row = ticketRow(page, 'MOB-1');
      await expect(row).toBeVisible();
      // Past the 228px of Status, Labels and Delete, but short of the full swipe.
      await swipeLeft(row, 250);
      await expect(page.getByRole('button', { name: 'Labels', exact: true })).toBeVisible();
      await expect(status).toBeHidden();
      // A tap on the open row only closes it.
      await row.click();
      await expect(page.getByRole('button', { name: 'Labels', exact: true })).toBeHidden();
      await swipeLeft(row, width === 375 ? 290 : 280);
      await expect(status).toBeVisible();
      await expect(status).toContainText('Move MOB-1 to');
      await status.getByRole('button', { name: 'Cancel' }).click();
      await expect(status).toBeHidden();
    }
  });
});
