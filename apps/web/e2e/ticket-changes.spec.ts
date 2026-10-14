import { randomUUID } from 'node:crypto';
import type { TrackerClient } from '@tracker/client';
import { expect, test } from './fixtures';
import { seedProject, settledScreenshot, toast } from './helpers';

const DIFF = [
  'diff --git a/apps/web/src/features/ticket/changes/TicketChanges.tsx b/apps/web/src/features/ticket/changes/TicketChanges.tsx',
  '--- a/apps/web/src/features/ticket/changes/TicketChanges.tsx',
  '+++ b/apps/web/src/features/ticket/changes/TicketChanges.tsx',
  '@@ -1,3 +1,3 @@',
  ' const x = 1;',
  "-const label = 'a long line of code that has to wrap on a phone rather than scroll sideways';",
  "+const label = 'a longer line of code that has to wrap on a phone rather than scroll the page';",
  ' export { x };',
  'diff --git a/README.md b/README.md',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/README.md',
  '@@ -0,0 +1 @@',
  '+# Hello',
  '',
].join('\n');
const CODE_FILE = /^apps\/web\/src\/features\/ticket\/changes\/TicketChanges\.tsx/;

// The helper's side, as `tracker watch` sends a ticket run's changes (apps/agent/src/watch/changes).
async function runWithChanges(api: TrackerClient): Promise<void> {
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: "Dara's MacBook", projectKeys: ['MOB'] });
  await api.startRun('MOB-1', { runnerId: helperId, prompt: 'Fix it' });
  const job = await api.takeNextRun(helperId, 'ticket');
  await api.addRunChanges(job!.run.id, { runnerId: helperId, diff: DIFF, cut: false });
  await api.finishRun(job!.run.id, { status: 'done' });
}

test('shows a run’s changes, keeps line comments and viewed ticks, and asks for changes', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB', [
    { title: 'Rename the label', status: 'Need review' },
  ]);
  await runWithChanges(api);
  await page.goto('/p/MOB/1');
  await page.getByRole('button', { name: 'Changes 2' }).click();
  await expect(page.getByText('0 of 2 viewed')).toBeVisible();

  await page.getByRole('button', { name: CODE_FILE }).click();
  const added = page.getByRole('button', { name: /Added line 2/ });
  const removed = page.getByRole('button', { name: /Removed line 2/ });
  const background = (line: typeof added) =>
    line.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(await background(added)).toBe('rgb(233, 246, 238)');
  expect(await background(removed)).toBe('rgb(253, 236, 235)');
  // Long paths and lines wrap: nothing scrolls the page sideways at 375px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

  await added.click();
  await page.getByRole('textbox', { name: /^Comment on .* line 2$/ }).fill('Say “label” once.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText('Say “label” once.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Viewed README.md' }).check();
  await expect(page.getByText('1 of 2 viewed')).toBeVisible();
  await settledScreenshot(page, info.outputPath(`ticket-changes-${info.project.name}.png`));

  await page.reload();
  await page.getByRole('button', { name: 'Changes 2' }).click();
  await expect(page.getByText('1 of 2 viewed')).toBeVisible();
  await expect(page.getByText('1 line comment goes to Claude on its next run.')).toBeVisible();
  await page.getByRole('button', { name: CODE_FILE }).click();
  await expect(page.getByText('Say “label” once.')).toBeVisible();

  await page.getByRole('button', { name: 'Ask for changes' }).click();
  await expect(
    toast(page, 'Asked for changes. Claude gets your line comments on its next run.'),
  ).toBeVisible();
  const { text } = await api.getTicketPrompt('MOB-1');
  expect(text).toContain(
    '- On apps/web/src/features/ticket/changes/TicketChanges.tsx line 2: Say “label” once.',
  );
  expect((await api.getTicket('MOB-1')).status.name).toBe('To do');
});
