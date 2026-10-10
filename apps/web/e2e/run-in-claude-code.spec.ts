import { randomUUID } from 'node:crypto';
import { expect, isPhone, test } from './fixtures';
import { seedProject, toast } from './helpers';

const HELPER = "Dara's MacBook";

const sendButton = (projectName: string) =>
  isPhone(projectName) ? 'Send to Claude' : 'Send to Claude Code';

// The test plays the helper (tracker watch) over the API: it checks in, takes the run and ends it.
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
  await expect(dialog.getByRole('switch')).toHaveCount(0);
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
