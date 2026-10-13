import { randomUUID } from 'node:crypto';
import type { Locator } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { readActionSheet, seedProject, settled, settledScreenshot } from './helpers';

// PT-189: the phone shows what each helper can use, so a person knows what to ask of it.

const DARA = "Dara's MacBook";
const TOOLS = {
  servers: ['GitHub', 'Notion', 'Gmail', 'Google Drive', 'Google Calendar'],
  commands: ['standup', 'weekly-report'],
  skills: ['drafting'],
};
const NAMES =
  'GitHub, Notion, Gmail, Google Drive, Google Calendar, /standup, /weekly-report, /drafting';

const sendButton = (projectName: string) =>
  isPhone(projectName) ? 'Send to Claude' : 'Send to Claude Code';

const isCut = (row: Locator) =>
  row.evaluate((element) => {
    const value = element.lastElementChild?.previousElementSibling as HTMLElement;
    return value.scrollWidth > value.clientWidth;
  });

test.beforeEach(async ({ api }) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Draft the newsletter' }]);
  await api.registerRunner(randomUUID(), { name: DARA, projectKeys: ['MOB'], tools: TOOLS });
  await api.registerRunner(randomUUID(), { name: 'Studio', projectKeys: ['MOB'] });
});

test("the Run on rows name the helper's tools on one line", async ({ page }, info) => {
  await page.goto('/p/MOB/1');
  await page.getByRole('button', { name: sendButton(info.project.name), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Send to Claude Code' });
  const runOn = dialog.getByRole('button', { name: /^Run on/ });
  await expect(runOn).toBeVisible();
  await runOn.click();
  await page.getByRole('option', { name: new RegExp(`^${DARA}`) }).click();
  await expect(runOn).toHaveAttribute('title', `${DARA} · ${NAMES}`);
  await expect(runOn).toHaveText(new RegExp(`Run on\\s*${DARA} · GitHub`));
  const rowHeight = (await runOn.boundingBox())?.height ?? 0;
  expect(rowHeight).toBeLessThan(60);
  expect(await isCut(runOn)).toBe(true);
  await settled(dialog);
  await settledScreenshot(page, info.outputPath(`prompt-run-on-${info.project.name}.png`));

  await page.goto('/p/MOB/ask/new');
  const chatRunOn = page.getByRole('button', { name: /^Run on/ });
  await chatRunOn.click();
  await page.getByRole('option', { name: new RegExp(`^${DARA}`) }).click();
  await expect(chatRunOn).toHaveAttribute('title', `${DARA} · ${NAMES}`);
  expect((await chatRunOn.boundingBox())?.height ?? 0).toBeLessThan(60);
  await settledScreenshot(page, info.outputPath(`chat-run-on-${info.project.name}.png`));
});

test('Connect Claude Code lists every tool of each computer', async ({ page }, info) => {
  await page.goto('/p/MOB');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Connect Claude Code' }).click();
  const sheet = page.getByRole('dialog', { name: 'Connect Claude Code' });
  const computers = sheet.getByRole('list', { name: 'Your computers' });
  await expect(computers.getByRole('listitem').first()).toContainText(NAMES);
  await expect(computers.getByRole('listitem').nth(1)).toHaveText(/^Studio\s*MOB · Online$/);
  await computers.scrollIntoViewIfNeeded();
  await settled(sheet);
  const box = await computers.boundingBox();
  const sheetBox = await sheet.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(sheetBox!.x + sheetBox!.width);
  await settledScreenshot(page, info.outputPath(`connect-tools-${info.project.name}.png`));
});
