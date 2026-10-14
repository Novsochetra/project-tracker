import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { PLAN_FOLLOW_UP, type AddRunRequestInput } from '@tracker/shared';
import { expect, isPhone, test } from './fixtures';
import { seedProject, settled, settledScreenshot } from './helpers';

const HELPER = "Dara's MacBook";
const PLAN = [
  '# Batch the capture sync',
  '',
  '1. Queue captures in **syncQueue** instead of sending each one.',
  '2. Send up to ten in one request from `useCaptureSync.ts`.',
  '3. Add tests for the batch and for a failed send.',
].join('\n');

const fitsWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// PT-235: a Plan question's ExitPlanMode shows as a card; approving carries the plan out.
test('approves a plan from the chat and Claude carries it out in the picked mode', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const runnerId = randomUUID();
  await api.registerRunner(runnerId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Plan' }).click();
  await page.getByRole('textbox', { name: 'Question for Claude' }).fill('Plan a faster sync');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
  const job = await api.takeNextRun(runnerId, 'ask');
  const runId = job!.run.id;
  // The helper's side (apps/agent/src/watch/permissionTool): post the plan, wait for the person.
  const plan: AddRunRequestInput = {
    runnerId,
    kind: 'plan',
    label: PLAN,
    labelCut: false,
    questions: null,
  };
  const asks = async () => {
    const request = await api.addRunRequest(runId, plan);
    return api.waitForRunRequest(request.id, { runnerId });
  };

  const kept = asks();
  const card = page.getByRole('region', { name: 'Claude asks: Batch the capture sync' });
  await expect(card.getByText('Claude has a plan')).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Batch the capture sync' })).toBeVisible();
  await expect(page.getByText('Claude is waiting for your answer.')).toBeVisible();
  await settled(card);
  expect(await fitsWidth(page)).toBe(true);
  await settledScreenshot(page, info.outputPath(`ask-plan-${info.project.name}.png`));
  if (isPhone(info.project.name)) {
    await page.setViewportSize({ width: 320, height: 568 });
    await settled(card);
    expect(await fitsWidth(page)).toBe(true);
    await settledScreenshot(page, info.outputPath('ask-plan-320.png'));
    await page.setViewportSize({ width: 375, height: 812 });
  }

  await card.getByRole('textbox', { name: /Note for Claude/ }).fill('Retry a failed batch once');
  await card.getByRole('button', { name: 'Keep planning' }).click();
  expect(await kept).toMatchObject({ decision: 'deny', answers: ['Retry a failed batch once'] });
  await expect(card).toContainText('Retry a failed batch once');

  const approved = asks();
  // The kept plan stays shown, settled, above the new one.
  const auto = page.getByRole('button', { name: 'Approve and auto' });
  const again = card.filter({ has: auto });
  await expect(again).toBeVisible();
  await again.getByRole('button', { name: 'Approve and auto' }).click();
  expect(await approved).toMatchObject({ decision: 'allow', answers: ['auto'] });
  await expect(page.getByText('Approved: carried out in Auto')).toBeVisible();

  const sessionId = randomUUID();
  await api.finishRun(runId, { status: 'done', answer: 'The plan is approved.', sessionId });
  await expect(page.getByText(PLAN_FOLLOW_UP)).toBeVisible();
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
  const next = await api.takeNextRun(runnerId, 'ticket');
  expect(next).toMatchObject({ resumeSessionId: sessionId, run: { askOptions: { mode: 'auto' } } });
  await settledScreenshot(page, info.outputPath(`ask-plan-approved-${info.project.name}.png`));
});
