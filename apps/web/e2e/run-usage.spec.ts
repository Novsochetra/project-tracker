import { randomUUID } from 'node:crypto';
import { expect, test, usesPhoneLayout } from './fixtures';
import { readActionSheet, seedProject, settledScreenshot } from './helpers';

const HELPER = "Dara's MacBook";

test('shows what runs took on the ticket, under an answer and in the project options', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash when rotating' }]);
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });

  // The helper's side, as `tracker watch` ends a run (apps/agent/src/watch/usage).
  await api.startRun('MOB-1', { runnerId: helperId, prompt: 'Fix MOB-1, please.' });
  const run = await api.takeNextRun(helperId, 'ticket');
  await api.finishRun(run!.run.id, {
    status: 'done',
    usage: { costMicros: 840_000, turns: 23, durationMs: 361_000 },
  });
  await page.goto('/p/MOB/1');
  const card = page.getByRole('region', { name: 'Claude Code run' });
  await expect(card).toContainText(`Claude finished on ${HELPER}.`);
  await expect(card).toContainText('6 min · 23 turns · about $0.84');
  await settledScreenshot(page, info.outputPath(`run-usage-ticket-${info.project.name}.png`));

  const { chat } = await api.startChat('MOB', {
    runnerId: helperId,
    text: 'Where are runs queued?',
  });
  const ask = await api.takeNextRun(helperId, 'ask');
  await api.finishRun(ask!.run.id, {
    status: 'done',
    answer: 'In apps/server/src/services/runQueue.ts.',
    usage: { costMicros: 8_719, turns: 3, durationMs: 9_146 },
  });
  await page.goto(`/p/MOB/ask/${chat.id}`);
  const claude = page.getByRole('article', { name: 'Claude' });
  await expect(claude).toContainText('9 s · 3 turns · about $0.01');
  await settledScreenshot(page, info.outputPath(`run-usage-answer-${info.project.name}.png`));

  await page.goto('/p/MOB');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  const phone = await usesPhoneLayout(page);
  const options = phone
    ? page.getByRole('dialog', { name: 'Project options' })
    : page.getByRole('group', { name: 'Project options' });
  await expect(options).toContainText(
    'Claude Code, last 30 days: 2 runs · 6 min · 26 turns · about $0.85',
  );
  if (phone) await readActionSheet(page);
  await settledScreenshot(page, info.outputPath(`run-usage-project-${info.project.name}.png`));
});
