import { randomUUID } from 'node:crypto';
import { DO_IT_TEXT } from '../src/features/ask/doItCopy';
import { expect, test } from './fixtures';
import { readActionSheet, seedProject, settledScreenshot } from './helpers';

const HELPER = "Dara's MacBook";

// PT-185: after a Plan answer, Do it goes ahead in Edit on the same helper, after asking first.
test('goes ahead with a plan from the chat, on the helper that made it, after asking', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Plan' }).click();
  await page.getByRole('textbox', { name: 'Question for Claude' }).fill('Plan a faster sync');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const doIt = page.getByRole('button', { name: 'Do it', exact: true });
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
  await expect(doIt).toHaveCount(0);

  const plan = await api.takeNextRun(helperId, 'ask');
  const sessionId = randomUUID();
  const text = '1. Batch the captures.\n2. Send them in one request.';
  await api.finishRun(plan!.run.id, { status: 'done', answer: text, sessionId });
  await expect(doIt).toBeVisible();
  await settledScreenshot(page, info.outputPath(`ask-do-it-${info.project.name}.png`));

  await doIt.click();
  const sheet = page.getByRole('dialog', { name: 'Do it' });
  await expect(sheet).toContainText(`Claude will change files on ${HELPER}.`);
  await settledScreenshot(page, info.outputPath(`ask-do-it-confirm-${info.project.name}.png`));
  expect(await api.takeNextRun(helperId, 'ticket')).toBeNull();
  await readActionSheet(page);
  await sheet.getByRole('button', { name: 'Do it', exact: true }).click();

  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
  await expect(doIt).toHaveCount(0);
  const job = await api.takeNextRun(helperId, 'ticket');
  expect(job?.run.askOptions?.mode).toBe('edit');
  expect(job?.resumeSessionId).toBe(sessionId);
  expect(job?.prompt).toContain(DO_IT_TEXT);
  await api.finishRun(job!.run.id, { status: 'done', answer: 'Batched the captures.', sessionId });

  const messages = page.getByRole('list', { name: 'Messages' });
  await expect(messages.getByRole('article', { name: 'Claude' }).last()).toContainText('Batched');
  await expect(messages.getByRole('article', { name: 'You' }).last()).toHaveText(DO_IT_TEXT);
  await expect(doIt).toHaveCount(0);
});
