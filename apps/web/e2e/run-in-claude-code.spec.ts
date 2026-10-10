import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject, toast } from './helpers';

const HELPER = "Dara's MacBook";
const LONG = 'Steps to reproduce, what happened and what should happen instead. '.repeat(10);

const sendButton = (projectName: string) =>
  isPhone(projectName) ? 'Send to Claude' : 'Send to Claude Code';

const viewports = (projectName: string) =>
  isPhone(projectName)
    ? [
        { width: 375, height: 812 },
        { width: 320, height: 568 },
      ]
    : [{ width: 1280, height: 800 }];

async function doubleTap(page: Page, target: Locator, touch: boolean): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Nothing to tap.');
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (touch) {
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
    await page.touchscreen.tap(x, y);
    return;
  }
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
}

test('runs a ticket on a helper and follows the run on the ticket', async ({ page, api }, info) => {
  await seedProject(api, 'Mobile app', 'MOB', [
    { title: 'Crash when rotating', description: 'Rotate twice.' },
  ]);
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/1');
  const send = page.getByRole('button', { name: sendButton(info.project.name), exact: true });
  const dialog = page.getByRole('dialog', { name: 'Send to Claude Code' });
  const run = dialog.getByRole('button', { name: 'Run in Claude Code' });
  const card = page.getByRole('region', { name: 'Claude Code run' });

  await send.click();
  await dialog.getByRole('textbox', { name: 'Prompt for Claude Code' }).fill('Fix MOB-1, please.');
  await expect(dialog.getByRole('switch')).toBeChecked();
  await run.click();
  await expect(toast(page, `Sent to Claude on ${HELPER}`)).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText(`Claude is working on ${HELPER}…`);

  const job = await api.takeNextRun(helperId);
  expect(job?.prompt).toBe('Fix MOB-1, please.');
  await api.finishRun(job!.run.id, { status: 'failed', error: 'Claude exited with code 1.' });
  await expect(card).toContainText('Claude stopped: Claude exited with code 1.');

  await card.getByRole('button', { name: 'Try again' }).click();
  await run.click();
  await expect(card).toContainText(`Claude is working on ${HELPER}…`);
  const again = await api.takeNextRun(helperId);
  await api.finishRun(again!.run.id, { status: 'done' });
  await expect(card).toHaveCount(0);
});

// Long descriptions put the bottom bar's Send to Claude under Run, short ones the comment box or
// the description.
test('a double tap on Run starts one run and leaves the screen alone', async ({
  page,
  api,
}, info) => {
  const cases = viewports(info.project.name).flatMap((viewport) =>
    [LONG, 'Rotate twice.'].map((description) => ({ viewport, description })),
  );
  await seedProject(
    api,
    'Mobile app',
    'MOB',
    cases.map(({ description }) => ({ title: 'Crash when rotating', description })),
  );
  await api.registerRunner(randomUUID(), { name: HELPER, projectKeys: ['MOB'] });
  const dialog = page.getByRole('dialog', { name: 'Send to Claude Code' });
  const run = dialog.getByRole('button', { name: 'Run in Claude Code' });

  for (const [index, { viewport }] of cases.entries()) {
    await page.setViewportSize(viewport);
    await page.goto(`/p/MOB/${index + 1}`);
    await page.getByRole('button', { name: sendButton(info.project.name), exact: true }).click();
    await expect(run).toBeVisible();
    await doubleTap(page, run, Boolean(info.project.use.hasTouch));
    await expect(toast(page, `Sent to Claude on ${HELPER}`)).toBeVisible();
    await page.waitForTimeout(300);

    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toMatch(
      /TEXTAREA|INPUT/,
    );
    expect(await api.listTicketRuns(`MOB-${index + 1}`)).toHaveLength(1);
  }
});
